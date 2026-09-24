import { prisma } from '../db/client.js';
import { emailQueue } from '../queue/emailQueue.js';

interface ScheduleInput {
  subject: string;
  body: string;
  recipients: string[];
  sendAt: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  senderId?: string | null;
  senderEmail?: string | null;
}

export async function scheduleEmails(input: ScheduleInput) {
  const baseTime = new Date(input.sendAt);
  const delayMs = input.delayBetweenEmails * 1000;

  const emailRecords = input.recipients.map((recipient, index) => ({
    recipient,
    subject: input.subject,
    body: input.body,
    sendAt: new Date(baseTime.getTime() + index * delayMs),
    delayBetweenEmails: input.delayBetweenEmails,
    hourlyLimit: input.hourlyLimit,
    senderId: input.senderId || null,
    senderEmail: input.senderEmail || null,
  }));

  const created = await prisma.$transaction(
    emailRecords.map((record) => prisma.email.create({ data: record }))
  );

  const now = Date.now();
  const jobs = created.map((email) => ({
    name: 'send-email',
    data: { emailId: email.id },
    opts: {
      jobId: email.id,
      delay: Math.max(0, email.sendAt.getTime() - now),
    },
  }));

  await emailQueue.addBulk(jobs);

  return created.map((email) => ({
    id: email.id,
    recipient: email.recipient,
    sendAt: email.sendAt.toISOString(),
  }));
}

export async function getScheduledEmails(senderId?: string) {
  return prisma.email.findMany({
    where: {
      status: 'SCHEDULED',
      ...(senderId ? { senderId } : {}),
    },
    orderBy: { sendAt: 'asc' },
    select: {
      id: true,
      recipient: true,
      subject: true,
      sendAt: true,
      status: true,
      senderId: true,
    },
  });
}

export async function getSentEmails(senderId?: string) {
  return prisma.email.findMany({
    where: {
      status: 'SENT',
      ...(senderId ? { senderId } : {}),
    },
    orderBy: { sentAt: 'desc' },
    select: {
      id: true,
      recipient: true,
      subject: true,
      sentAt: true,
      status: true,
      previewUrl: true,
      senderId: true,
    },
  });
}
