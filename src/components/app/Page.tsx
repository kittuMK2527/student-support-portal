import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
export function Loading() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="size-6 animate-spin text-primary" aria-label="Loading" />
    </div>
  );
}
export function ErrorState({ error }: { error: unknown }) {
  return (
    <Alert tone="error">{error instanceof Error ? error.message : 'Something went wrong.'}</Alert>
  );
}

export function QueryView<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  if (query.data === undefined) return null;
  return <>{children(query.data)}</>;
}
