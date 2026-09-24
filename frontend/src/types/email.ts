export type EmailStatus = 'scheduled' | 'sent' | 'failed';

export interface ScheduledEmail {
  id: string;
  recipient: string;
  subject: string;
  scheduledAt: string;
  status: Extract<EmailStatus, 'scheduled'>;
}

export interface SentEmail {
  id: string;
  recipient: string;
  subject: string;
  sentAt: string;
  status: Extract<EmailStatus, 'sent' | 'failed'>;
}

export interface ScheduleEmailRequest {
  subject: string;
  body: string;
  recipients: string[];
  sendAt: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export interface ScheduleEmailResponse {
  message: string;
  jobCount: number;
}
