import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  EyeOff,
  Globe,
  Hourglass,
  Lock,
  Mail,
  Route,
  Send,
  UserRound,
} from 'lucide-react';
import type { TicketEvent, TicketStatus } from '@/types';
import { api } from '@/lib/api';
import type { AdminTicketDetail as Detail } from '@/lib/api';
import { useAdminAction, useAdminTicket, useOutbox, useReference } from '@/lib/api/hooks';
import { RESOLUTION_MIN, STATUS_LABEL, type Transition } from '@/lib/workflow/transitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loading, ErrorState } from '@/components/app/Page';
import { StatusBadge, categoryLabel } from '@/components/app/StatusBadge';
import { cn, fmtDate, fmtDateTime } from '@/lib/utils';
import { ApiError } from '@/lib/api';

type DialogKind = null | 'assign' | 'clarify' | 'resolve' | 'close';

export default function AdminTicketDetail() {
  const { id = '' } = useParams();
  const { data, isLoading, error } = useAdminTicket(id);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [flash, setFlash] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const transition = useAdminAction((to: TicketStatus) => api.admin.transition(id, to));

  if (isLoading) return <Loading />;
  if (error || !data)
    return (
      <>
        <Back />
        <ErrorState error={error} />
      </>
    );
  const d = data;
  const t = d.ticket;

  const onAction = (a: Transition) => {
    setFlash(null);
    if (a.to === 'assigned') return setDialog('assign');
    if (a.to === 'awaiting_student') return setDialog('clarify');
    if (a.to === 'resolved') return setDialog('resolve');
    if (a.to === 'closed') return setDialog('close');
    transition.mutate(a.to, {
      onSuccess: () =>
        setFlash({ tone: 'success', text: `Status changed to ${STATUS_LABEL[a.to]}.` }),
      onError: (e) => setFlash({ tone: 'error', text: e.message }),
    });
  };
  const done = (text: string) => {
    setDialog(null);
    setFlash({ tone: 'success', text });
  };

  return (
    <>
      <Back />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold text-primary">{t.id}</span>
                <StatusBadge status={t.status} />
                {d.overdue && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                    <Hourglass className="size-3" /> Overdue
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold">{t.subject}</h1>
              <CardDescription>
                {categoryLabel(t)} · {d.college.name} · submitted {fmtDateTime(t.createdAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm break-words whitespace-pre-wrap">{t.description}</p>
              {t.resolutionNote && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
                  <p className="mb-1 font-semibold text-emerald-800">Resolution note</p>
                  <p className="whitespace-pre-wrap">{t.resolutionNote}</p>
                </div>
              )}
              <div className="border-t pt-4">
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Next actions
                </p>
                <Alert tone={flash?.tone ?? 'info'}>{flash?.text}</Alert>
                {d.nextActions.length ? (
                  <div className={cn('flex flex-wrap gap-2', flash && 'mt-2')}>
                    {d.nextActions.map((a) => (
                      <Button
                        key={a.to + a.label}
                        variant={a.to === 'resolved' || a.to === 'closed' ? 'default' : 'outline'}
                        loading={transition.isPending && transition.variables === a.to}
                        onClick={() => onAction(a)}
                        title={a.hint}
                      >
                        {a.label}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t.status === 'closed'
                      ? 'This ticket is closed. No further actions.'
                      : t.status === 'awaiting_student'
                        ? 'Waiting for the student to reply. It returns to Under Review automatically when they do.'
                        : 'No actions available.'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          {t.status !== 'closed' && <UpdateComposer d={d} onDone={done} />}
          <AuditLog events={d.events} />
        </div>
        <aside className="space-y-6">
          <StudentCard d={d} />
          <AssignmentCard d={d} />
          <ActionPlan d={d} />
          <TicketEmails id={t.id} />
        </aside>
      </div>
      {dialog === 'assign' && <AssignDialog d={d} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'clarify' && (
        <TextDialog
          title="Request clarification"
          description="The student is emailed and the ticket waits for their reply."
          label="What should the student clarify?"
          min={10}
          action="Send request"
          submit={(m) => api.admin.requestClarification(t.id, m)}
          onClose={() => setDialog(null)}
          onDone={() => done('Clarification requested. The student has been emailed.')}
        />
      )}
      {dialog === 'resolve' && (
        <TextDialog
          title="Mark resolved"
          description={`The student sees this note and can reopen within 7 days.`}
          label="Resolution note"
          min={RESOLUTION_MIN}
          action="Mark resolved"
          initial={t.resolutionNote}
          submit={(m) => api.admin.resolve(t.id, m)}
          onClose={() => setDialog(null)}
          onDone={() => done('Marked as resolved.')}
        />
      )}
      {dialog === 'close' && (
        <TextDialog
          title="Close ticket"
          description="Both the student and the campus manager receive a closure email with this summary."
          label="Final resolution note"
          min={RESOLUTION_MIN}
          action="Close ticket"
          initial={t.resolutionNote}
          submit={(m) => api.admin.close(t.id, m)}
          onClose={() => setDialog(null)}
          onDone={() =>
            done('Ticket closed. Closure emails sent to the student and the campus manager.')
          }
        />
      )}
    </>
  );
}

const Back = () => (
  <Link
    to="/admin"
    className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
  >
    <ArrowLeft className="size-4" /> Tickets
  </Link>
);
function UpdateComposer({ d, onDone }: { d: Detail; onDone: (m: string) => void }) {
  const ref = useReference();
  const owners = (ref.data?.owners ?? []).filter((o) => o.collegeId === d.ticket.collegeId);
  const [visibility, setVisibility] = useState<'public' | 'internal'>('public');
  const [message, setMessage] = useState('');
  const [onBehalf, setOnBehalf] = useState('');
  const add = useAdminAction(() =>
    api.admin.addUpdate(d.ticket.id, {
      message,
      visibility,
      onBehalfOfOwnerId: onBehalf || undefined,
    }),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add update</CardTitle>
        <CardDescription>
          Public updates appear on the student's timeline. Internal notes are only visible here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(undefined, {
              onSuccess: () => {
                setMessage('');
                onDone(
                  visibility === 'public'
                    ? 'Public update added. The student can see it.'
                    : 'Internal note added.',
                );
              },
            });
          }}
        >
          <div
            className="inline-flex w-fit gap-1 rounded-lg bg-muted p-1 text-sm"
            role="radiogroup"
            aria-label="Visibility"
          >
            {(['public', 'internal'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={visibility === v}
                onClick={() => setVisibility(v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium',
                  visibility === v
                    ? v === 'internal'
                      ? 'bg-amber-100 text-amber-900 shadow-sm'
                      : 'bg-card shadow-sm'
                    : 'text-muted-foreground',
                )}
              >
                {v === 'public' ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
                {v === 'public' ? 'Public (student sees it)' : 'Internal note'}
              </button>
            ))}
          </div>
          <Textarea
            rows={3}
            aria-label="Update"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={cn(visibility === 'internal' && 'border-amber-300 bg-amber-50/40')}
            placeholder={
              visibility === 'public'
                ? 'e.g. Placement cell has contacted TCS HR; expect the letter by Friday.'
                : 'Only staff can see this.'
            }
          />
          <Field
            id="onbehalf"
            label="Recorded on behalf of (optional)"
            hint="Use this to record a functional owner's progress; they do not log in."
          >
            <NativeSelect value={onBehalf} onChange={(e) => setOnBehalf(e.target.value)}>
              <option value="">Myself (campus manager)</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} · {ref.data?.teams.find((t) => t.id === o.teamId)?.name}
                  {d.ticket.currentAssignment?.ownerId === o.id ? ' (current owner)' : ''}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Alert tone="error">{add.error?.message}</Alert>
          <div className="flex justify-end">
            <Button type="submit" loading={add.isPending} disabled={message.trim().length < 3}>
              <Send /> Add {visibility === 'public' ? 'update' : 'note'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
const EVENT_TEXT: Record<TicketEvent['type'], (e: TicketEvent) => string> = {
  created: () => 'Ticket submitted',
  status_changed: (e) =>
    `Status ${e.fromStatus ? `${STATUS_LABEL[e.fromStatus]} → ` : ''}${STATUS_LABEL[e.toStatus!]}`,
  assigned: (e) => `Assigned to ${e.meta?.owner} (${e.meta?.team})`,
  reassigned: (e) =>
    `Reassigned from ${e.meta?.previousOwner} (${e.meta?.previousTeam}) to ${e.meta?.owner} (${e.meta?.team})`,
  public_update: () => 'Public update',
  internal_note: () => 'Internal note',
  clarification_requested: () => 'Clarification requested from the student',
  student_reply: () => 'Student replied',
  action_added: (e) => `Action item added: ${e.meta?.responsible}, due ${e.meta?.due}`,
  action_done: () => 'Action item done',
  action_reopened: () => 'Action item reopened',
  resolved: () => 'Resolution note',
  closed: () => 'Closed with resolution',
  reopened: () => 'Reopened by the student',
};

function AuditLog({ events }: { events: TicketEvent[] }) {
  const [hideInternal, setHide] = useState(false);
  const list = useMemo(
    () => [...events].reverse().filter((e) => !hideInternal || e.visibility === 'public'),
    [events, hideInternal],
  );
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>History &amp; audit log</CardTitle>
          <CardDescription>Every change, who made it and when.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setHide(!hideInternal)}>
          <EyeOff /> {hideInternal ? 'Show internal' : 'Student view'}
        </Button>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-l pl-5">
          {list.map((e) => (
            <li key={e.id} className="relative">
              <span
                className={cn(
                  'absolute top-1 -left-[25px] size-2.5 rounded-full ring-4 ring-card',
                  e.visibility === 'internal' ? 'bg-amber-500' : 'bg-primary',
                )}
                aria-hidden
              />
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {EVENT_TEXT[e.type](e)}
                {e.visibility === 'internal' ? (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                    <Lock className="size-3" /> Internal
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700">
                    <Globe className="size-3" /> Student sees
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {e.actor.name}
                {e.actor.kind === 'admin'
                  ? ' (campus manager)'
                  : e.actor.kind === 'student'
                    ? ' (student)'
                    : ''}
                {e.onBehalfOf && (
                  <>
                    {' '}
                    on behalf of <b>{e.onBehalfOf.name}</b> ({e.onBehalfOf.team})
                  </>
                )}{' '}
                · {fmtDateTime(e.at)}
              </p>
              {e.message && (
                <p className="mt-1 text-sm whitespace-pre-wrap">
                  {e.type === 'assigned' || e.type === 'reassigned' ? (
                    <>
                      <span className="text-muted-foreground">Rationale: </span>
                      {e.message}
                    </>
                  ) : (
                    e.message
                  )}
                </p>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
function StudentCard({ d }: { d: Detail }) {
  const s = d.student;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserRound className="size-4" /> Student
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-1.5 text-sm">
          {[
            ['Name', s.fullName],
            ['Roll no.', s.rollNumber],
            ['Department', s.department],
            ['Year', `Year ${s.yearOfStudy}`],
            ['College', d.college.name],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="truncate text-right">
              <a className="text-primary hover:underline" href={`mailto:${s.email}`}>
                {s.email}
              </a>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function AssignmentCard({ d }: { d: Detail }) {
  const currentId = d.ticket.currentAssignment?.id;
  const current = currentId ? d.assignments.find((a) => a.id === currentId) : undefined;
  const previous = d.assignments.filter((a) => a.id !== current?.id).reverse();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Route className="size-4" /> Ownership
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {current ? (
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="font-medium">
              {current.ownerName}{' '}
              <span className="font-normal text-muted-foreground">· {current.teamName}</span>
            </p>
            <p className="text-xs text-muted-foreground">{current.ownerEmail}</p>
            <p className="mt-1 text-xs">Why: {current.rationale}</p>
            <p className="text-xs text-muted-foreground">Since {fmtDateTime(current.assignedAt)}</p>
          </div>
        ) : (
          <p className="text-muted-foreground">
            {d.ticket.status === 'in_progress'
              ? 'Handled by the campus manager.'
              : 'Not assigned to a team.'}
          </p>
        )}
        {previous.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Previous owners
            </p>
            <ul className="space-y-1.5">
              {previous.map((a) => (
                <li key={a.id} className="text-xs">
                  <span className="font-medium">{a.ownerName}</span> ({a.teamName}) ·{' '}
                  {fmtDate(a.assignedAt)} – {fmtDate(a.endedAt)}
                  <span className="block text-muted-foreground">{a.rationale}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionPlan({ d }: { d: Detail }) {
  const t = d.ticket;
  const ownerName = d.assignments.find((a) => a.id === t.currentAssignment?.id)?.ownerName ?? '';
  // null = not edited yet, so it follows whoever currently owns the ticket
  const [form, setF] = useState<{ text: string; responsible: string | null; dueDate: string }>({
    text: '',
    responsible: null,
    dueDate: '',
  });
  const f = { ...form, responsible: form.responsible ?? ownerName };
  const [errors, setErrors] = useState<Record<string, string>>({});
  const add = useAdminAction(() => api.admin.addAction(t.id, f));
  const toggle = useAdminAction((v: { itemId: string; done: boolean }) =>
    api.admin.toggleAction(t.id, v.itemId, v.done),
  );
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <ClipboardList className="size-4" /> Action plan
        </CardTitle>
        <CardDescription>Internal: not shown to the student.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {t.actionItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No action items yet.</p>
        ) : (
          <ul className="space-y-2">
            {t.actionItems.map((a) => (
              <li key={a.id} className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                  checked={a.done}
                  disabled={t.status === 'closed' || toggle.isPending}
                  aria-label={`Done: ${a.text}`}
                  onChange={(e) => toggle.mutate({ itemId: a.id, done: e.target.checked })}
                />
                <span className="min-w-0">
                  <span className={cn('block', a.done && 'text-muted-foreground line-through')}>
                    {a.text}
                  </span>
                  <span
                    className={cn(
                      'flex items-center gap-1 text-xs',
                      !a.done && a.dueDate < today
                        ? 'font-medium text-red-600'
                        : 'text-muted-foreground',
                    )}
                  >
                    <CalendarClock className="size-3" /> {a.responsible} · due {fmtDate(a.dueDate)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {t.status !== 'closed' && (
          <form
            className="grid gap-2 border-t pt-3"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate(undefined, {
                onSuccess: () => {
                  setF({ text: '', responsible: null, dueDate: '' });
                  setErrors({});
                },
                onError: (err) =>
                  setErrors(err instanceof ApiError && err.fields ? err.fields : {}),
              });
            }}
          >
            <Field id="act-text" label="Next action" error={errors.text}>
              <Input
                value={f.text}
                onChange={(e) => setF({ ...form, text: e.target.value })}
                placeholder="e.g. Call TCS HR about the letter"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field id="act-resp" label="Responsible" error={errors.responsible}>
                <Input
                  value={f.responsible}
                  onChange={(e) => setF({ ...form, responsible: e.target.value })}
                />
              </Field>
              <Field id="act-due" label="Due" error={errors.dueDate}>
                <Input
                  type="date"
                  value={f.dueDate}
                  min={today}
                  onChange={(e) => setF({ ...form, dueDate: e.target.value })}
                />
              </Field>
            </div>
            <Button type="submit" variant="outline" size="sm" loading={add.isPending}>
              Add action item
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function TicketEmails({ id }: { id: string }) {
  const { data } = useOutbox(id);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Mail className="size-4" /> Emails for this ticket
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data?.length ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {data.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/admin/outbox?mail=${m.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {m.subject}
                </Link>
                <span className="block text-muted-foreground">
                  to {m.to.join(', ')} · {fmtDateTime(m.sentAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
function AssignDialog({
  d,
  onClose,
  onDone,
}: {
  d: Detail;
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const ref = useReference();
  const reassign = !!d.ticket.currentAssignment;
  const suggested = (
    {
      Examination: 'team_exams',
      Fees: 'team_finance',
      Placement: 'team_placement',
      Mentor: 'team_mentoring',
      'Teaching Style': 'team_academics',
      Infrastructure: 'team_operations',
      Other: '',
    } as Record<string, string>
  )[d.ticket.category];
  const [f, setF] = useState({ teamId: reassign ? '' : suggested, ownerId: '', rationale: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const owners = (ref.data?.owners ?? []).filter(
    (o) => o.collegeId === d.ticket.collegeId && o.teamId === f.teamId,
  );
  const assign = useAdminAction(() => api.admin.assign(d.ticket.id, f));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{reassign ? 'Reassign ticket' : 'Assign to a team'}</DialogTitle>
          <DialogDescription>
            The owner is emailed the ticket.{' '}
            {reassign && 'The previous owner stays in the history.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const errs: Record<string, string> = {};
            if (!f.teamId) errs.teamId = 'Choose a team';
            if (!f.ownerId) errs.ownerId = 'Choose an owner';
            if (f.rationale.trim().length < 10)
              errs.rationale = 'Explain why (at least 10 characters)';
            setErrors(errs);
            if (Object.keys(errs).length) return;
            assign.mutate(undefined, {
              onSuccess: () =>
                onDone(
                  reassign
                    ? 'Ticket reassigned. The new owner has been emailed.'
                    : 'Ticket assigned. The owner has been emailed.',
                ),
              onError: (err) =>
                setErrors(err instanceof ApiError && err.fields ? err.fields : { _: err.message }),
            });
          }}
        >
          <Alert tone="error">{errors._}</Alert>
          <Field
            id="team"
            label="Team"
            error={errors.teamId}
            hint={!reassign && suggested ? 'Suggested from the ticket category' : undefined}
          >
            <NativeSelect
              value={f.teamId}
              onChange={(e) => setF({ ...f, teamId: e.target.value, ownerId: '' })}
            >
              <option value="">Choose a team</option>
              {ref.data?.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="owner" label="Owner" error={errors.ownerId}>
            <NativeSelect
              value={f.ownerId}
              onChange={(e) => setF({ ...f, ownerId: e.target.value })}
              disabled={!f.teamId}
            >
              <option value="">{f.teamId ? 'Choose an owner' : 'Choose a team first'}</option>
              {owners.map((o) => (
                <option
                  key={o.id}
                  value={o.id}
                  disabled={o.id === d.ticket.currentAssignment?.ownerId}
                >
                  {o.name} ({o.email})
                  {o.id === d.ticket.currentAssignment?.ownerId ? ' · current owner' : ''}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="rationale" label="Rationale (required)" error={errors.rationale}>
            <Textarea
              rows={3}
              value={f.rationale}
              onChange={(e) => setF({ ...f, rationale: e.target.value })}
              placeholder="Why this team and person?"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={assign.isPending}>
              <Route /> {reassign ? 'Reassign' : 'Assign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TextDialog({
  title,
  description,
  label,
  min,
  action,
  initial,
  submit,
  onClose,
  onDone,
}: {
  title: string;
  description: string;
  label: string;
  min: number;
  action: string;
  initial?: string;
  submit: (text: string) => Promise<unknown>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState(initial ?? '');
  const [err, setErr] = useState('');
  const m = useAdminAction(submit);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim().length < min)
              return setErr(`At least ${min} characters (${text.trim().length} so far)`);
            m.mutate(text, { onSuccess: onDone, onError: (e2) => setErr(e2.message) });
          }}
        >
          <Field
            id="dlg-text"
            label={label}
            error={err}
            hint={`${text.trim().length} characters, at least ${min}`}
          >
            <Textarea
              rows={4}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setErr('');
              }}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={m.isPending}>
              <CheckCircle2 /> {action}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
