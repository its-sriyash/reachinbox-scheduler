import StatusBadge from './StatusBadge';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';
import type { EmailStatus } from '../types/email';

interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface EmailTableProps<T extends { id: string; status: EmailStatus }> {
  data: T[];
  columns: Column<T>[];
  loading: boolean;
  error: string | null;
  emptyTitle: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
}

export default function EmailTable<T extends { id: string; status: EmailStatus }>({
  data,
  columns,
  loading,
  error,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
}: EmailTableProps<T>) {
  if (loading) {
    return <LoadingState message="Fetching emails…" />;
  }

  if (error) {
    return (
      <div className="state-container">
        <p className="state-error">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <div className="table-wrapper">
      <table className="email-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id}>
              {columns.map((col) => (
                <td key={String(col.key)}>
                  {col.render
                    ? col.render(row[col.key], row)
                    : col.key === 'status'
                      ? <StatusBadge status={row.status} />
                      : String(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
