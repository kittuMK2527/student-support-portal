import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlarmClock,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  Eye,
  Hourglass,
  MessageCircleQuestion,
  CheckCircle2,
  Archive,
  Search,
  X,
} from 'lucide-react';
import { CATEGORIES, STATUSES, type TicketStatus } from '@/types';
import { STATUS_LABEL } from '@/lib/workflow/transitions';
import { useAdminList, useAdminSummary, useReference } from '@/lib/api/hooks';
import type { AdminListQuery } from '@/lib/api';
import { useSession } from '@/lib/store/session';
import { Card } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader, Loading, ErrorState } from '@/components/app/Page';
import { StatusBadge, categoryLabel } from '@/components/app/StatusBadge';
import { cn, fmtDate } from '@/lib/utils';

type SummaryKey =
  'open' | 'underReview' | 'inProgress' | 'awaitingStudent' | 'resolved' | 'closed' | 'overdue';
const CARDS: {
  key: SummaryKey;
  label: string;
  status: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}[] = [
  { key: 'open', label: 'Open', status: 'open', icon: CircleDot, tone: 'text-sky-600 bg-sky-50' },
  {
    key: 'underReview',
    label: 'Under Review',
    status: 'under_review',
    icon: Eye,
    tone: 'text-violet-600 bg-violet-50',
  },
  {
    key: 'inProgress',
    label: 'In Progress',
    status: 'in_progress',
    icon: Clock,
    tone: 'text-amber-600 bg-amber-50',
  },
  {
    key: 'awaitingStudent',
    label: 'Awaiting Student',
    status: 'awaiting_student',
    icon: MessageCircleQuestion,
    tone: 'text-fuchsia-600 bg-fuchsia-50',
  },
  {
    key: 'resolved',
    label: 'Resolved',
    status: 'resolved',
    icon: CheckCircle2,
    tone: 'text-emerald-600 bg-emerald-50',
  },
  {
    key: 'closed',
    label: 'Closed',
    status: 'closed',
    icon: Archive,
    tone: 'text-slate-600 bg-slate-100',
  },
  {
    key: 'overdue',
    label: 'Overdue',
    status: 'overdue',
    icon: AlarmClock,
    tone: 'text-red-600 bg-red-50',
  },
];
const SORTABLE: { key: NonNullable<AdminListQuery['sort']>; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'student', label: 'Student' },
  { key: 'college', label: 'College' },
  { key: 'category', label: 'Category' },
  { key: 'createdAt', label: 'Date' },
  { key: 'owner', label: 'Owner' },
  { key: 'status', label: 'Status' },
];

export default function AdminDashboard() {
  const user = useSession((s) => s.user);
  const ref = useReference();
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) || '';
  const set = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    if (!('page' in patch)) p.delete('page');
    setParams(p, { replace: true });
  };
  const [q, setQ] = useState(get('q'));
  useEffect(() => {
    const t = setTimeout(() => {
      setParams(
        (prev) => {
          const value = q.trim();
          if ((prev.get('q') ?? '') === value) return prev;
          const next = new URLSearchParams(prev);
          if (value) next.set('q', value);
          else next.delete('q');
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    }, 300);
    return () => clearTimeout(t);
  }, [q, setParams]);

  const query: AdminListQuery = {
    q: get('q') || undefined,
    status: (get('status') || undefined) as AdminListQuery['status'],
    category: (get('category') || undefined) as AdminListQuery['category'],
    collegeId: get('college') || undefined,
    teamId: get('team') || undefined,
    ownerId: get('owner') || undefined,
    from: get('from') || undefined,
    to: get('to') || undefined,
    sort: (get('sort') || 'createdAt') as AdminListQuery['sort'],
    dir: (get('dir') || (get('sort') && get('sort') !== 'createdAt' ? 'asc' : 'desc')) as
      'asc' | 'desc',
    page: Number(get('page') || 1),
    pageSize: 10,
  };
  const summary = useAdminSummary(query.collegeId);
  const list = useAdminList(query);
  const myColleges =
    ref.data?.colleges.filter((c) => user?.role === 'admin' && user.collegeIds.includes(c.id)) ??
    [];
  const owners = (ref.data?.owners ?? []).filter(
    (o) =>
      (!query.teamId || o.teamId === query.teamId) &&
      (!query.collegeId || o.collegeId === query.collegeId),
  );
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  const active = ['q', 'status', 'category', 'college', 'team', 'owner', 'from', 'to'].some((k) =>
    get(k),
  );
  const sortBy = (k: string) =>
    set({
      sort: k,
      dir:
        query.sort === k
          ? query.dir === 'asc'
            ? 'desc'
            : 'asc'
          : k === 'createdAt'
            ? 'desc'
            : 'asc',
    });

  return (
    <>
      <PageHeader
        title="Tickets"
        description={
          user?.role === 'admin'
            ? `${user.title}. You see tickets from ${myColleges.map((c) => c.code).join(' and ')}.`
            : undefined
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {CARDS.map((c) => {
          const n = summary.data?.[c.key] ?? 0;
          const selected = get('status') === c.status;
          return (
            <button
              key={c.key}
              onClick={() => set({ status: selected ? '' : c.status })}
              aria-pressed={selected}
              className={cn(
                'rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/40',
                selected && 'border-primary ring-2 ring-primary/20',
              )}
            >
              <span className={cn('inline-flex rounded-md p-1.5', c.tone)}>
                <c.icon className="size-4" />
              </span>
              <span className="mt-2 block text-2xl font-bold">{summary.isLoading ? '–' : n}</span>
              <span className="block text-xs font-medium text-muted-foreground">{c.label}</span>
            </button>
          );
        })}
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              className="pl-8"
              placeholder="Search ID, student, roll no., subject"
              aria-label="Search tickets"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <NativeSelect
            aria-label="Status"
            className="w-auto"
            value={get('status')}
            onChange={(e) => set({ status: e.target.value })}
          >
            <option value="">Status: all</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s as TicketStatus]}
              </option>
            ))}
            <option value="overdue">Overdue</option>
          </NativeSelect>
          <NativeSelect
            aria-label="Category"
            className="w-auto"
            value={get('category')}
            onChange={(e) => set({ category: e.target.value })}
          >
            <option value="">Category: all</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
          {myColleges.length > 1 && (
            <NativeSelect
              aria-label="College"
              className="w-auto"
              value={get('college')}
              onChange={(e) => set({ college: e.target.value, owner: '' })}
            >
              <option value="">College: all</option>
              {myColleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </NativeSelect>
          )}
          <NativeSelect
            aria-label="Team"
            className="w-auto"
            value={get('team')}
            onChange={(e) => set({ team: e.target.value, owner: '' })}
          >
            <option value="">Team: all</option>
            {ref.data?.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Owner"
            className="w-auto"
            value={get('owner')}
            onChange={(e) => set({ owner: e.target.value })}
          >
            <option value="">Owner: all</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </NativeSelect>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            From{' '}
            <Input
              type="date"
              className="w-auto"
              value={get('from')}
              max={get('to') || undefined}
              onChange={(e) => set({ from: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            To{' '}
            <Input
              type="date"
              className="w-auto"
              value={get('to')}
              min={get('from') || undefined}
              onChange={(e) => set({ to: e.target.value })}
            />
          </label>
          {active && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ('');
                setParams({}, { replace: true });
              }}
            >
              <X /> Clear
            </Button>
          )}
        </div>
        {list.isLoading ? (
          <Loading />
        ) : list.error || !list.data ? (
          <div className="p-4">
            <ErrorState error={list.error} />
          </div>
        ) : (
          <>
            <Table className={cn(list.isFetching && 'opacity-70')}>
              <TableHeader>
                <TableRow>
                  {SORTABLE.map((c) => (
                    <TableHead
                      key={c.key}
                      aria-sort={
                        query.sort === c.key
                          ? query.dir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      <button
                        className="inline-flex items-center gap-1 uppercase hover:text-foreground"
                        onClick={() => sortBy(c.key)}
                      >
                        {c.label}
                        {query.sort === c.key ? (
                          query.dir === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      No tickets match these filters.
                    </TableCell>
                  </TableRow>
                )}
                {list.data.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-64">
                      <Link
                        to={`/admin/tickets/${r.id}`}
                        className="block font-mono text-xs font-semibold text-primary hover:underline"
                      >
                        {r.id}
                      </Link>
                      <Link
                        to={`/admin/tickets/${r.id}`}
                        className="block truncate text-sm hover:text-primary"
                        title={r.subject}
                      >
                        {r.subject}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="block">{r.student.name}</span>
                      <span className="text-xs text-muted-foreground">{r.student.rollNumber}</span>
                    </TableCell>
                    <TableCell title={r.college.name} className="font-mono text-xs">
                      {r.college.code}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{categoryLabel(r)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="block">{fmtDate(r.createdAt)}</span>
                      {r.overdue && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                          <Hourglass className="size-3" /> Overdue
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.owner ? (
                        <>
                          <span className="block">{r.owner.name}</span>
                          <span className="text-xs text-muted-foreground">{r.owner.team}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          {r.status === 'in_progress' ? 'Campus manager' : 'Unassigned'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t px-3 py-2 text-sm text-muted-foreground">
              <span>
                {list.data.total} ticket{list.data.total === 1 ? '' : 's'}
              </span>
              <span className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={query.page! <= 1}
                  onClick={() => set({ page: String(query.page! - 1) })}
                  aria-label="Previous page"
                >
                  <ChevronLeft />
                </Button>
                Page {query.page} of {pages}
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={query.page! >= pages}
                  onClick={() => set({ page: String(query.page! + 1) })}
                  aria-label="Next page"
                >
                  <ChevronRight />
                </Button>
              </span>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
