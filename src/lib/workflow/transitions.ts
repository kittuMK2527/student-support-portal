import type { TicketStatus } from '@/types';

export type Actor = 'student' | 'admin' | 'system';
export type Requirement =
  'assignment' | 'resolutionNote' | 'reason' | 'clarificationMessage' | 'withinReopenWindow';

export interface Transition {
  to: TicketStatus;
  actors: Actor[];
  label: string;
  requires?: Requirement[];
  hint?: string;
}

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  under_review: 'Under Review',
  in_progress: 'In Progress',
  assigned: 'Assigned to Team',
  awaiting_student: 'Awaiting Student Response',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened',
};

export const REOPEN_WINDOW_DAYS = 7;
export const SLA_DAYS = 5; // active tickets older than this are overdue
export const RESOLUTION_MIN = 20;

export const TRANSITIONS: Record<TicketStatus, Transition[]> = {
  open: [
    {
      to: 'under_review',
      actors: ['admin'],
      label: 'Acknowledge & review',
      hint: 'Happens when the manager opens the ticket',
    },
  ],
  under_review: [
    { to: 'in_progress', actors: ['admin'], label: 'Handle it myself (In Progress)' },
    { to: 'assigned', actors: ['admin'], label: 'Assign to a team', requires: ['assignment'] },
    {
      to: 'awaiting_student',
      actors: ['admin'],
      label: 'Request clarification',
      requires: ['clarificationMessage'],
    },
  ],
  awaiting_student: [
    {
      to: 'under_review',
      actors: ['system'],
      label: 'Student replied',
      hint: 'Automatic when the student replies',
    },
  ],
  assigned: [
    { to: 'in_progress', actors: ['admin'], label: 'Take back (handle myself)' },
    { to: 'assigned', actors: ['admin'], label: 'Reassign', requires: ['assignment'] },
    { to: 'resolved', actors: ['admin'], label: 'Mark resolved', requires: ['resolutionNote'] },
  ],
  in_progress: [
    { to: 'assigned', actors: ['admin'], label: 'Assign to a team', requires: ['assignment'] },
    { to: 'resolved', actors: ['admin'], label: 'Mark resolved', requires: ['resolutionNote'] },
  ],
  resolved: [
    {
      to: 'closed',
      actors: ['admin', 'system'],
      label: 'Close ticket',
      requires: ['resolutionNote'],
      hint: `Closes on its own ${REOPEN_WINDOW_DAYS} days after resolution`,
    },
    {
      to: 'reopened',
      actors: ['student'],
      label: 'Reopen',
      requires: ['reason', 'withinReopenWindow'],
    },
  ],
  reopened: [{ to: 'under_review', actors: ['admin'], label: 'Review again' }],
  closed: [],
};

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransitionError';
  }
}

export function findTransition(from: TicketStatus, to: TicketStatus): Transition | undefined {
  return TRANSITIONS[from].find((t) => t.to === to);
}

export function nextActions(from: TicketStatus, actor: Actor): Transition[] {
  return TRANSITIONS[from].filter((t) => t.actors.includes(actor));
}

export interface TransitionContext {
  assignment?: { teamId?: string; ownerId?: string; rationale?: string };
  resolutionNote?: string;
  reason?: string;
  clarificationMessage?: string;
  resolvedAt?: string;
  now?: Date;
}

export function assertTransition(
  from: TicketStatus,
  to: TicketStatus,
  actor: Actor,
  ctx: TransitionContext = {},
): Transition {
  const t = findTransition(from, to);
  if (!t) {
    const allowed = TRANSITIONS[from].map((x) => STATUS_LABEL[x.to]);
    throw new TransitionError(
      `A ticket that is ${STATUS_LABEL[from]} cannot move to ${STATUS_LABEL[to]}.` +
        (allowed.length ? ` Allowed next: ${allowed.join(', ')}.` : ' It is final.'),
    );
  }
  if (!t.actors.includes(actor)) {
    throw new TransitionError(
      `Only ${t.actors.join(' or ')} can move a ticket from ${STATUS_LABEL[from]} to ${STATUS_LABEL[to]}.`,
    );
  }
  for (const r of t.requires ?? []) {
    if (r === 'assignment') {
      const a = ctx.assignment;
      if (!a?.teamId || !a?.ownerId) throw new TransitionError('Choose a team and an owner.');
      if (!a.rationale || a.rationale.trim().length < 10)
        throw new TransitionError('Give a rationale for the routing (at least 10 characters).');
    }
    if (
      r === 'resolutionNote' &&
      actor !== 'system' &&
      (ctx.resolutionNote ?? '').trim().length < RESOLUTION_MIN
    ) {
      throw new TransitionError(
        `A resolution note of at least ${RESOLUTION_MIN} characters is required.`,
      );
    }
    if (r === 'reason' && (ctx.reason ?? '').trim().length < 10)
      throw new TransitionError('Give a reason for reopening (at least 10 characters).');
    if (r === 'clarificationMessage' && (ctx.clarificationMessage ?? '').trim().length < 10) {
      throw new TransitionError('Write what the student should clarify (at least 10 characters).');
    }
    if (r === 'withinReopenWindow') {
      if (!ctx.resolvedAt) throw new TransitionError('This ticket has no resolution date.');
      const days = ((ctx.now ?? new Date()).getTime() - new Date(ctx.resolvedAt).getTime()) / 864e5;
      if (days > REOPEN_WINDOW_DAYS)
        throw new TransitionError(
          `The ${REOPEN_WINDOW_DAYS}-day window to reopen this ticket has passed.`,
        );
    }
  }
  return t;
}

export const ACTIVE_STATUSES: TicketStatus[] = [
  'open',
  'under_review',
  'in_progress',
  'assigned',
  'awaiting_student',
  'reopened',
];
export function isOverdue(
  t: { status: TicketStatus; createdAt: string },
  now = new Date(),
): boolean {
  return (
    ACTIVE_STATUSES.includes(t.status) &&
    (now.getTime() - new Date(t.createdAt).getTime()) / 864e5 > SLA_DAYS
  );
}
