import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MessageSquareReply, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { useMyTicket, useStudentAction } from '@/lib/api/hooks';
import { STATUS_LABEL, REOPEN_WINDOW_DAYS } from '@/lib/workflow/transitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Loading, ErrorState } from '@/components/app/Page';
import { StatusBadge, categoryLabel } from '@/components/app/StatusBadge';
import { fmtDate, fmtDateTime } from '@/lib/utils';
import type { StudentTicket } from '@/lib/api';

function describe(e: StudentTicket['timeline'][number]) {
  switch (e.type) {
    case 'created':
      return 'Ticket submitted';
    case 'status_changed':
      return `Status: ${e.fromStatus ? `${STATUS_LABEL[e.fromStatus]} → ` : ''}${STATUS_LABEL[e.toStatus!]}`;
    case 'clarification_requested':
      return 'More information requested';
    case 'student_reply':
      return 'Your reply';
    case 'resolved':
      return 'Resolution';
    case 'closed':
      return 'Ticket closed';
    case 'reopened':
      return 'You reopened the ticket';
    default:
      return 'Update';
  }
}

export default function StudentTicketDetail() {
  const { id = '' } = useParams();
  const { data: t, isLoading, error } = useMyTicket(id);
  const reply = useStudentAction((m: string) => api.student.reply(id, m));
  const reopen = useStudentAction((r: string) => api.student.reopen(id, r));
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState('');

  if (isLoading) return <Loading />;
  if (error || !t)
    return (
      <>
        <BackLink />
        <ErrorState error={error} />
      </>
    );
  const tk = t;
  return (
    <>
      <BackLink />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold text-primary">{tk.id}</span>
                <StatusBadge status={tk.status} />
              </div>
              <h1 className="text-xl font-bold">{tk.subject}</h1>
              <p className="text-xs text-muted-foreground">
                {categoryLabel(tk)} · submitted {fmtDateTime(tk.createdAt)}
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-sm break-words whitespace-pre-wrap">{tk.description}</p>
            </CardContent>
          </Card>

          {tk.resolutionNote && (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="size-4" />{' '}
                  {tk.status === 'closed' ? 'Final resolution' : 'Resolution'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm whitespace-pre-wrap">{tk.resolutionNote}</p>
                {tk.status === 'closed' && (
                  <p className="text-xs text-muted-foreground">
                    Closed {fmtDateTime(tk.closedAt)}
                    {tk.closedBy === 'system'
                      ? ` (automatically, ${REOPEN_WINDOW_DAYS} days after resolution)`
                      : ''}
                    .
                  </p>
                )}
                {tk.canReopen && (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      Not solved? You can reopen it until {fmtDate(tk.reopenDeadline)}.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                      <RotateCcw /> Reopen ticket
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {tk.canReply && (
            <Card className="border-fuchsia-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareReply className="size-4 text-fuchsia-700" /> Your campus manager
                  needs more information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (message.trim()) reply.mutate(message, { onSuccess: () => setMessage('') });
                  }}
                >
                  <p className="rounded-md bg-muted px-3 py-2 text-sm">
                    {
                      [...tk.timeline].reverse().find((x) => x.type === 'clarification_requested')
                        ?.message
                    }
                  </p>
                  <Alert tone="error">{reply.error?.message}</Alert>
                  <Textarea
                    rows={4}
                    aria-label="Your reply"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your answer…"
                  />
                  <div className="flex justify-end">
                    <Button type="submit" loading={reply.isPending} disabled={!message.trim()}>
                      Send reply
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-5 border-l pl-5">
                {[...tk.timeline].reverse().map((e) => (
                  <li key={e.id} className="relative">
                    <span
                      className="absolute top-1 -left-[25px] size-2.5 rounded-full bg-primary ring-4 ring-card"
                      aria-hidden
                    />
                    <p className="text-sm font-medium">{describe(e)}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.actorLabel} · {fmtDateTime(e.at)}
                    </p>
                    {e.message && e.type !== 'created' && (
                      <p className="mt-1 text-sm whitespace-pre-wrap text-foreground/90">
                        {e.message}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={tk.status} />
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="text-right">{categoryLabel(tk)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Handled by</dt>
                <dd className="text-right">
                  {tk.assignedTeam
                    ? `${tk.assignedTeam}${tk.assignedTeam === 'Campus manager' ? '' : ' team'}`
                    : 'Campus manager (review)'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Submitted</dt>
                <dd className="text-right">{fmtDate(tk.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Last update</dt>
                <dd className="text-right">{fmtDateTime(tk.updatedAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          setReasonErr('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen {tk.id}</DialogTitle>
            <DialogDescription>Tell your campus manager what is still not right.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (reason.trim().length < 10)
                return setReasonErr('Give a reason (at least 10 characters)');
              reopen.mutate(reason, {
                onSuccess: () => {
                  setOpen(false);
                  setReason('');
                },
                onError: (err) => setReasonErr(err.message),
              });
            }}
          >
            <Field id="reason" label="Reason" error={reasonErr}>
              <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" loading={reopen.isPending}>
                <RotateCcw /> Reopen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

const BackLink = () => (
  <Link
    to="/student/tickets"
    className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
  >
    <ArrowLeft className="size-4" /> My tickets
  </Link>
);
