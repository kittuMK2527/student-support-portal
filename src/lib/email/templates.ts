import type { College, Student, Ticket } from '@/types';
import { STATUS_LABEL } from '@/lib/workflow/transitions';

const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5175';
const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
const category = (t: Ticket) =>
  t.category === 'Other' && t.customCategory ? `Other (${t.customCategory})` : t.category;

export function ticketSubmitted(t: Ticket, s: Student, c: College) {
  return {
    subject: `New ticket ${t.id}: ${t.subject}`,
    body: [
      'A student has raised a new support ticket.',
      '',
      `Ticket ID: ${t.id}`,
      `Category: ${category(t)}`,
      `Subject: ${t.subject}`,
      `Student: ${s.fullName} (Roll no. ${s.rollNumber})`,
      `Department / year: ${s.department}, year ${s.yearOfStudy}`,
      `College: ${c.name}`,
      `Submitted: ${fmt(t.createdAt)}`,
      '',
      `Open the ticket: ${APP_URL}/admin/tickets/${t.id}`,
    ].join('\n'),
  };
}

export function ticketClosed(t: Ticket, audience: 'student' | 'manager', s: Student) {
  return {
    subject: `Ticket ${t.id} closed: ${t.subject}`,
    body: [
      audience === 'student' ? `Hello ${s.fullName},` : 'Hello,',
      '',
      audience === 'student'
        ? 'Your support ticket has been closed.'
        : `The ticket raised by ${s.fullName} (${s.rollNumber}) has been closed.`,
      '',
      `Ticket ID: ${t.id}`,
      `Subject: ${t.subject}`,
      `Opened: ${fmt(t.createdAt)}`,
      `Closed: ${fmt(t.closedAt)}${t.closedBy === 'system' ? ' (automatically, 7 days after resolution)' : ''}`,
      '',
      'Resolution summary:',
      t.resolutionNote ?? '-',
      '',
      audience === 'student'
        ? `View it: ${APP_URL}/student/tickets/${t.id}`
        : `View it: ${APP_URL}/admin/tickets/${t.id}`,
    ].join('\n'),
  };
}

export function ticketRouted(
  t: Ticket,
  owner: { name: string },
  team: string,
  rationale: string,
  by: string,
  s: Student,
  c: College,
  reassigned: boolean,
) {
  return {
    subject: `${reassigned ? 'Reassigned' : 'Assigned'} to you: ${t.id} (${category(t)})`,
    body: [
      `Hello ${owner.name},`,
      '',
      `${by} has ${reassigned ? 'reassigned' : 'assigned'} a student ticket to you (${team} team).`,
      '',
      `Ticket ID: ${t.id}`,
      `Subject: ${t.subject}`,
      `Student: ${s.fullName} (Roll no. ${s.rollNumber}), ${c.name}`,
      `Why you: ${rationale}`,
      '',
      'Issue:',
      t.description,
      '',
      `Please send your progress to ${by}; they will record it on the ticket.`,
    ].join('\n'),
  };
}

export function clarificationRequested(t: Ticket, s: Student, message: string) {
  return {
    subject: `Ticket ${t.id}: more information needed`,
    body: [
      `Hello ${s.fullName},`,
      '',
      'To work on your ticket we need a little more information:',
      '',
      message,
      '',
      `Reply here: ${APP_URL}/student/tickets/${t.id}`,
    ].join('\n'),
  };
}

export function ticketReopened(t: Ticket, s: Student, reason: string) {
  return {
    subject: `Ticket ${t.id} reopened by the student`,
    body: [
      `${s.fullName} (${s.rollNumber}) has reopened ticket ${t.id} ("${t.subject}").`,
      '',
      'Reason:',
      reason,
      '',
      `Status is now ${STATUS_LABEL.reopened}. Open it: ${APP_URL}/admin/tickets/${t.id}`,
    ].join('\n'),
  };
}
