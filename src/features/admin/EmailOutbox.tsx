import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Inbox, Mail } from 'lucide-react';
import { useOutbox } from '@/lib/api/hooks';
import { emailService } from '@/lib/email/service';
import { Card, CardContent } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/input';
import { PageHeader, Loading, ErrorState } from '@/components/app/Page';
import { cn, fmtDateTime } from '@/lib/utils';
import type { EmailMessage } from '@/types';

const TEMPLATE: Record<EmailMessage['template'], [string, string]> = {
  ticket_submitted: ['New ticket', 'bg-sky-50 text-sky-700'],
  ticket_closed: ['Closed', 'bg-slate-100 text-slate-700'],
  ticket_routed: ['Routed', 'bg-orange-50 text-orange-800'],
  clarification_requested: ['Clarification', 'bg-fuchsia-50 text-fuchsia-700'],
  ticket_reopened: ['Reopened', 'bg-red-50 text-red-700'],
};

export default function EmailOutbox() {
  const [params, setParams] = useSearchParams();
  const { data, isLoading, error } = useOutbox();
  const [template, setTemplate] = useState('');
  const list = (data ?? []).filter((m) => !template || m.template === template);
  const selected = list.find((m) => m.id === params.get('mail')) ?? list[0];
  return (
    <>
      <PageHeader
        title="Email outbox"
        description={
          <>
            Emails are not really sent: provider <b>{emailService().name}</b>. The{' '}
            <code>EmailService</code> interface lets a real provider be plugged in.
          </>
        }
        actions={
          <NativeSelect
            aria-label="Template"
            className="w-auto"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          >
            <option value="">All emails</option>
            {Object.entries(TEMPLATE).map(([k, [l]]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </NativeSelect>
        }
      />
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-14 text-center">
            <Inbox className="size-10 text-muted-foreground/50" />
            <p className="mt-3 font-semibold">No emails yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <Card className="max-h-[70vh] overflow-y-auto">
            <ul className="divide-y" aria-label="Emails">
              {list.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => setParams({ mail: m.id }, { replace: true })}
                    aria-current={selected?.id === m.id}
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-muted/60',
                      selected?.id === m.id && 'bg-accent',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                          TEMPLATE[m.template][1],
                        )}
                      >
                        {TEMPLATE[m.template][0]}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {fmtDateTime(m.sentAt)}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-sm font-medium">{m.subject}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      to {m.to.join(', ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {selected && (
            <Card>
              <CardContent className="space-y-3 pt-5">
                <h2 className="flex items-start gap-2 text-lg font-semibold">
                  <Mail className="mt-1 size-4 shrink-0 text-primary" />
                  {selected.subject}
                </h2>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">To</dt>
                  <dd>{selected.to.join(', ')}</dd>
                  <dt className="text-muted-foreground">Sent</dt>
                  <dd>{fmtDateTime(selected.sentAt)}</dd>
                  {selected.ticketId && (
                    <>
                      <dt className="text-muted-foreground">Ticket</dt>
                      <dd>
                        <Link
                          className="font-mono text-primary hover:underline"
                          to={`/admin/tickets/${selected.ticketId}`}
                        >
                          {selected.ticketId}
                        </Link>
                      </dd>
                    </>
                  )}
                </dl>
                <pre className="rounded-lg border bg-muted/40 p-4 font-sans text-sm whitespace-pre-wrap">
                  {selected.body}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
