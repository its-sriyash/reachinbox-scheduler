import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({ message = 'Loading…' }: LoadingStateProps) {
  return (
    <div className="state-container">
      <Loader2 size={32} className="spinner" />
      <p className="state-message">{message}</p>
    </div>
  );
}
