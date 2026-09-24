import type { EmailStatus } from '../types/email';

const statusConfig: Record<EmailStatus, { label: string; className: string }> = {
  scheduled: { label: 'Scheduled', className: 'badge-scheduled' },
  sent: { label: 'Sent', className: 'badge-sent' },
  failed: { label: 'Failed', className: 'badge-failed' },
};

interface StatusBadgeProps {
  status: EmailStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return <span className={`badge ${config.className}`}>{config.label}</span>;
}
