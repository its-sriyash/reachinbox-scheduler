import { Router, Request, Response } from 'express';
import { scheduleEmails, getScheduledEmails, getSentEmails } from '../services/emailService.js';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateScheduleRequest(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return 'Request body must be a JSON object';
  }

  const { subject, body: emailBody, recipients, sendAt, delayBetweenEmails, hourlyLimit } =
    body as Record<string, unknown>;

  if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
    return 'subject is required and must be a non-empty string';
  }

  if (!emailBody || typeof emailBody !== 'string' || (emailBody as string).trim().length === 0) {
    return 'body is required and must be a non-empty string';
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return 'recipients must be a non-empty array';
  }

  for (const r of recipients) {
    if (typeof r !== 'string' || !EMAIL_REGEX.test(r)) {
      return `Invalid email address: ${r}`;
    }
  }

  if (!sendAt || typeof sendAt !== 'string') {
    return 'sendAt is required and must be a valid ISO date string';
  }

  const sendAtDate = new Date(sendAt);
  if (isNaN(sendAtDate.getTime())) {
    return 'sendAt must be a valid date';
  }

  if (sendAtDate.getTime() < Date.now()) {
    return 'sendAt must be in the future';
  }

  if (typeof delayBetweenEmails !== 'number' || delayBetweenEmails < 0) {
    return 'delayBetweenEmails must be a number >= 0';
  }

  if (typeof hourlyLimit !== 'number' || !Number.isInteger(hourlyLimit) || hourlyLimit < 1) {
    return 'hourlyLimit must be a positive integer';
  }

  return null;
}

router.post('/schedule', async (req: Request, res: Response) => {
  const error = validateScheduleRequest(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const { subject, body, recipients, sendAt, delayBetweenEmails, hourlyLimit } = req.body;

    const emails = await scheduleEmails({
      subject,
      body,
      recipients,
      sendAt,
      delayBetweenEmails,
      hourlyLimit,
      senderId: req.user?.id,
      senderEmail: req.user?.email,
    });

    return res.status(201).json({
      message: 'Emails scheduled successfully',
      jobCount: emails.length,
      emails,
    });
  } catch (err) {
    console.error('Failed to schedule emails:', err);
    return res.status(500).json({ error: 'Failed to schedule emails' });
  }
});

router.get('/scheduled', async (req: Request, res: Response) => {
  try {
    const emails = await getScheduledEmails(req.user?.id);

    const mapped = emails.map((e) => ({
      id: e.id,
      recipient: e.recipient,
      subject: e.subject,
      scheduledAt: e.sendAt.toISOString(),
      status: 'scheduled' as const,
    }));

    return res.json(mapped);
  } catch (err) {
    console.error('Failed to fetch scheduled emails:', err);
    return res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

router.get('/sent', async (req: Request, res: Response) => {
  try {
    const emails = await getSentEmails(req.user?.id);

    const mapped = emails.map((e) => ({
      id: e.id,
      recipient: e.recipient,
      subject: e.subject,
      sentAt: e.sentAt ? e.sentAt.toISOString() : null,
      status: 'sent' as const,
      previewUrl: e.previewUrl,
    }));

    return res.json(mapped);
  } catch (err) {
    console.error('Failed to fetch sent emails:', err);
    return res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

export default router;
