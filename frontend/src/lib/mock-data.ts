import type { User } from '../types/user';
import type { ScheduledEmail, SentEmail, ScheduleEmailRequest } from '../types/email';

export const MOCK_USER: User = {
  id: 'dev-user-001',
  name: 'Santanu Dev',
  email: 'santanu@example.com',
  avatar: '',
};

let inMemoryScheduled: ScheduledEmail[] = [
  {
    id: 'sch-1',
    recipient: 'alice@startup.io',
    subject: 'Partnership Opportunity',
    scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    status: 'scheduled',
  },
  {
    id: 'sch-2',
    recipient: 'bob@enterprise.com',
    subject: 'Q4 Outreach Campaign',
    scheduledAt: new Date(Date.now() + 7200000).toISOString(),
    status: 'scheduled',
  },
  {
    id: 'sch-3',
    recipient: 'carol@agency.co',
    subject: 'Follow-up: Product Demo',
    scheduledAt: new Date(Date.now() + 10800000).toISOString(),
    status: 'scheduled',
  },
];

const inMemorySent: SentEmail[] = [
  {
    id: 'sent-1',
    recipient: 'dave@techcorp.io',
    subject: 'Welcome to ReachInbox',
    sentAt: new Date(Date.now() - 86400000).toISOString(),
    status: 'sent',
  },
  {
    id: 'sent-2',
    recipient: 'eve@design.studio',
    subject: 'Onboarding Resources',
    sentAt: new Date(Date.now() - 172800000).toISOString(),
    status: 'sent',
  },
  {
    id: 'sent-3',
    recipient: 'frank@invalid-domain.com',
    subject: 'Intro Call Confirmation',
    sentAt: new Date(Date.now() - 259200000).toISOString(),
    status: 'failed',
  },
];

export function getMockScheduledEmails(): ScheduledEmail[] {
  return [...inMemoryScheduled];
}

export function getMockSentEmails(): SentEmail[] {
  return [...inMemorySent];
}

export function addMockScheduledEmails(request: ScheduleEmailRequest): ScheduledEmail[] {
  const newItems: ScheduledEmail[] = request.recipients.map((recipient, i) => ({
    id: `dev-sch-${Date.now()}-${i}`,
    recipient,
    subject: request.subject,
    scheduledAt: request.sendAt,
    status: 'scheduled',
  }));

  inMemoryScheduled = [...newItems, ...inMemoryScheduled];
  return newItems;
}
