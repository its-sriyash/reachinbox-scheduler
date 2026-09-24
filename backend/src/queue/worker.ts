import { Worker, Job, DelayedError } from 'bullmq';
import { redis } from '../db/redis.js';
import { prisma } from '../db/client.js';
import { emailQueue } from './emailQueue.js';
import { sendEmail } from '../services/emailSender.js';
import {
  checkAndConsumeRateLimit,
  checkAndReserveMinimumDelay,
} from '../services/rateLimiter.js';

export interface EmailJobData {
  emailId: string;
}

export async function processEmailJob(
  job: Job<EmailJobData>,
  token?: string
): Promise<void> {
  const { emailId } = job.data;

  if (!emailId) {
    const errorMsg = 'Job payload missing emailId';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // 1. Fetch Email record from PostgreSQL
  const email = await prisma.email.findUnique({
    where: { id: emailId },
  });

  // 2. If record does not exist, fail job appropriately
  if (!email) {
    const errorMsg = `Email record not found: ${emailId}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // 3. Status checks
  if (email.status === 'SENT') {
    console.log(`Email already sent ${emailId}`);
    return;
  }

  if (email.status === 'FAILED') {
    console.log(`Email already marked as failed, skipping send: ${emailId}`);
    return;
  }

  // 4. Idempotency: atomic claim SCHEDULED -> PROCESSING
  // Exactly one worker can update the row
  const claim = await prisma.email.updateMany({
    where: {
      id: emailId,
      status: 'SCHEDULED',
    },
    data: {
      status: 'PROCESSING',
    },
  });

  if (claim.count === 0) {
    // Another worker claimed the job or status changed
    const current = await prisma.email.findUnique({
      where: { id: emailId },
    });
    console.log(`Email ${emailId} already in status ${current?.status}, skipping send`);
    return;
  }

  // 5. Minimum Delay Check (enforces spacing between emails across concurrent workers)
  if (email.delayBetweenEmails > 0) {
    const delayCheck = await checkAndReserveMinimumDelay(email.delayBetweenEmails);
    if (!delayCheck.allowed) {
      console.log(
        `Delay of ${email.delayBetweenEmails}s not met for email ${emailId}. Rescheduling in ${delayCheck.waitMs}ms`
      );

      // Revert status to SCHEDULED so it can be processed when delay expires
      await prisma.email.updateMany({
        where: { id: emailId, status: 'PROCESSING' },
        data: { status: 'SCHEDULED' },
      });

      const nextTarget = Date.now() + delayCheck.waitMs;
      if (token && typeof job.moveToDelayed === 'function') {
        await job.moveToDelayed(nextTarget, token);
        throw new DelayedError();
      } else {
        await emailQueue.add('send-email', { emailId }, { delay: delayCheck.waitMs });
        return;
      }
    }
  }

  // 6. Redis-Backed Hourly Rate Limit Check
  const rateLimitCheck = await checkAndConsumeRateLimit(email.hourlyLimit);
  if (!rateLimitCheck.allowed) {
    console.log(
      `Hourly rate limit of ${email.hourlyLimit} reached (${rateLimitCheck.currentCount}/${email.hourlyLimit}). Rescheduling email ${emailId} for next window ${rateLimitCheck.resetAt.toISOString()}`
    );

    // Revert status to SCHEDULED and update sendAt to the next window boundary
    await prisma.email.updateMany({
      where: { id: emailId, status: 'PROCESSING' },
      data: {
        status: 'SCHEDULED',
        sendAt: rateLimitCheck.resetAt,
      },
    });

    const nextTarget = rateLimitCheck.resetAt.getTime();
    if (token && typeof job.moveToDelayed === 'function') {
      await job.moveToDelayed(nextTarget, token);
      throw new DelayedError();
    } else {
      await emailQueue.add('send-email', { emailId }, { delay: rateLimitCheck.retryAfterMs });
      return;
    }
  }

  console.log(`Processing email ${emailId}`);

  // 7. Send email via Ethereal SMTP
  try {
    const result = await sendEmail({
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
    });

    // 8. Update PostgreSQL to SENT only after SMTP send succeeds
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        messageId: result.messageId,
        previewUrl: result.previewUrl || null,
        lastError: null,
      },
    });

    console.log(`Email sent ${emailId}`);
    if (result.previewUrl) {
      console.log(`Preview URL: ${result.previewUrl}`);
    }
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    // Sanitize any passwords or credentials from error message
    const cleanError = rawMessage.replace(/:[^:@]+@/g, ':***@');

    console.error(`Email failed ${emailId}: ${cleanError}`);

    const maxAttempts = job.opts.attempts || 3;
    const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: isFinalAttempt ? 'FAILED' : 'SCHEDULED',
        lastError: cleanError,
        attempts: { increment: 1 },
      },
    });

    throw new Error(cleanError);
  }
}

// Dedicated connection for the worker to avoid blocking queue commands
const workerConnection = redis.duplicate();

const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

export const emailWorker = new Worker<EmailJobData>(
  'email-sending',
  async (job: Job<EmailJobData>, token?: string) => {
    await processEmailJob(job, token);
  },
  {
    connection: workerConnection,
    concurrency,
  }
);

emailWorker.on('ready', () => {
  console.log(`Worker started with concurrency ${concurrency}`);
});

emailWorker.on('failed', (job, err) => {
  if (job) {
    const maxAttempts = job.opts.attempts || 3;
    if (job.attemptsMade >= maxAttempts) {
      console.log(`Email failed permanently ${job.data.emailId}`);
    }
  }
});

export async function stopWorker(): Promise<void> {
  await emailWorker.close();
  await workerConnection.quit();
}
