import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export interface SendEmailOptions {
  recipient: string;
  subject: string;
  body: string;
  sender?: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

let transporter: Transporter | null = null;

export function getTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP credentials are not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in .env'
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

// Allow resetting transporter for tests (e.g. testing failed credentials)
export function resetTransporter(): void {
  transporter = null;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { recipient, subject, body, sender } = options;
  const from = sender || process.env.SMTP_FROM || 'ReachInbox <no-reply@reachinbox.ai>';

  const client = getTransporter();

  const info = await client.sendMail({
    from,
    to: recipient,
    subject,
    text: body,
    html: body.replace(/\n/g, '<br/>'),
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  return {
    messageId: info.messageId,
    previewUrl: previewUrl || false,
  };
}
