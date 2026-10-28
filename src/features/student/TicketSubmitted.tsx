import { Link, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useMyTicket } from '@/lib/api/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge, categoryLabel } from '@/components/app/StatusBadge';
import { Loading, ErrorState } from '@/components/app/Page';
import { fmtDateTime } from '@/lib/utils';

export default function TicketSubmitted() {
  const { id = '' } = useParams();
  const { data: t, isLoading, error } = useMyTicket(id);
  if (isLoading) return <Loading />;
  if (error || !t) return <ErrorState error={error} />;
  return (
    <Card className="mx-auto max-w-lg text-center">
      <CardContent className="flex flex-col items-center gap-3 py-10">
        <CheckCircle2 className="size-12 text-emerald-600" aria-hidden />
        <h1 className="text-xl font-bold">Ticket submitted</h1>
        <p className="text-sm text-muted-foreground">Keep this ID to follow up on your request.</p>
        <p
          className="rounded-lg border bg-muted px-4 py-2 font-mono text-lg font-bold tracking-wide"
          aria-label="Ticket ID"
        >
          {t.id}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-left text-sm">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <StatusBadge status={t.status} />
          </dd>
          <dt className="text-muted-foreground">Category</dt>
          <dd>{categoryLabel(t)}</dd>
          <dt className="text-muted-foreground">Subject</dt>
          <dd>{t.subject}</dd>
          <dt className="text-muted-foreground">Submitted</dt>
          <dd>{fmtDateTime(t.createdAt)}</dd>
        </dl>
        <p className="text-sm text-muted-foreground">
          Your campus manager has been emailed and will review it.
        </p>
        <div className="mt-2 flex gap-2">
          <Button asChild variant="outline">
            <Link to="/student/tickets">My tickets</Link>
          </Button>
          <Button asChild>
            <Link to={`/student/tickets/${t.id}`}>View ticket</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
