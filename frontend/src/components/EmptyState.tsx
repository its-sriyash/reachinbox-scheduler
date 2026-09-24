import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="state-container">
      <Inbox size={48} className="state-icon" />
      <h3 className="state-title">{title}</h3>
      {description && <p className="state-description">{description}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn btn-primary" style={{ marginTop: '1rem' }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
