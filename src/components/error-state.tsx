import { EmptyState } from '@/components/empty-state';

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = 'Something went wrong',
  message = 'Please check your connection and try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <EmptyState
      title={title}
      message={message}
      icon={{ ios: 'exclamationmark.triangle', android: 'error' }}
      action={onRetry ? { label: 'Try again', onPress: onRetry } : undefined}
    />
  );
}
