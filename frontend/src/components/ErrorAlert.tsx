import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
}

export function ErrorAlert({ message }: ErrorAlertProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
