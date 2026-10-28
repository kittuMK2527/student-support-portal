import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  nextActions,
  TRANSITIONS,
  TransitionError,
  isOverdue,
} from './transitions';
import { STATUSES } from '@/types';

describe('transition map', () => {
  it('covers every status', () => {
    for (const s of STATUSES) expect(TRANSITIONS[s]).toBeDefined();
  });

  it('allows exactly the specified moves', () => {
    const edges = STATUSES.flatMap((s) =>
      TRANSITIONS[s].map((t) => `${s}->${t.to}:${t.actors.join('|')}`),
    ).sort();
    expect(edges).toEqual([
      'assigned->assigned:admin',
      'assigned->in_progress:admin',
      'assigned->resolved:admin',
      'awaiting_student->under_review:system',
      'in_progress->assigned:admin',
      'in_progress->resolved:admin',
      'open->under_review:admin',
      'reopened->under_review:admin',
      'resolved->closed:admin|system',
      'resolved->reopened:student',
      'under_review->assigned:admin',
      'under_review->awaiting_student:admin',
      'under_review->in_progress:admin',
    ]);
    expect(TRANSITIONS.closed).toEqual([]);
  });

  it('blocks a disallowed move with a clear message', () => {
    expect(() => assertTransition('open', 'resolved', 'admin')).toThrow(
      /Open cannot move to Resolved\. Allowed next: Under Review/,
    );
    expect(() => assertTransition('closed', 'reopened', 'student')).toThrow(/It is final/);
  });

  it('checks the actor', () => {
    expect(() => assertTransition('under_review', 'in_progress', 'student')).toThrow(/Only admin/);
    expect(() =>
      assertTransition('resolved', 'reopened', 'admin', {
        reason: 'not fixed at all',
        resolvedAt: new Date().toISOString(),
      }),
    ).toThrow(/Only student/);
    expect(() => assertTransition('awaiting_student', 'under_review', 'admin')).toThrow(
      /Only system/,
    );
  });

  it('enforces requirements: assignment rationale, resolution note, reopen reason and the 7-day window', () => {
    expect(() =>
      assertTransition('under_review', 'assigned', 'admin', {
        assignment: { teamId: 't', ownerId: 'o', rationale: '' },
      }),
    ).toThrow(/rationale/);
    expect(() =>
      assertTransition('in_progress', 'resolved', 'admin', { resolutionNote: 'too short' }),
    ).toThrow(/at least 20/);
    expect(() => assertTransition('resolved', 'closed', 'admin', { resolutionNote: '' })).toThrow(
      TransitionError,
    );
    expect(assertTransition('resolved', 'closed', 'system').to).toBe('closed'); // the auto-close needs no new note
    const now = new Date('2026-10-28T10:00:00Z');
    expect(() =>
      assertTransition('resolved', 'reopened', 'student', {
        reason: 'still broken here',
        resolvedAt: '2026-10-20T09:00:00Z',
        now,
      }),
    ).toThrow(/window/);
    expect(
      assertTransition('resolved', 'reopened', 'student', {
        reason: 'still broken here',
        resolvedAt: '2026-10-22T10:00:00Z',
        now,
      }).to,
    ).toBe('reopened');
  });

  it('lists only valid next actions per actor', () => {
    expect(nextActions('under_review', 'admin').map((t) => t.to)).toEqual([
      'in_progress',
      'assigned',
      'awaiting_student',
    ]);
    expect(nextActions('resolved', 'student').map((t) => t.to)).toEqual(['reopened']);
    expect(nextActions('closed', 'admin')).toEqual([]);
  });

  it('flags active tickets older than the SLA as overdue', () => {
    const now = new Date('2026-10-28');
    expect(isOverdue({ status: 'assigned', createdAt: '2026-10-20' }, now)).toBe(true);
    expect(isOverdue({ status: 'resolved', createdAt: '2026-10-01' }, now)).toBe(false);
    expect(isOverdue({ status: 'open', createdAt: '2026-10-26' }, now)).toBe(false);
  });
});
