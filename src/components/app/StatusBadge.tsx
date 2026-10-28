import type { TicketStatus } from '@/types';
import { STATUS_LABEL } from '@/lib/workflow/transitions';
import { cn } from '@/lib/utils';

export const STATUS_TONE: Record<TicketStatus, string> = {
  open: 'bg-sky-50 text-sky-700 ring-sky-200',
  under_review: 'bg-violet-50 text-violet-700 ring-violet-200',
  in_progress: 'bg-amber-50 text-amber-800 ring-amber-200',
  assigned: 'bg-orange-50 text-orange-800 ring-orange-200',
  awaiting_student: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
  reopened: 'bg-red-50 text-red-700 ring-red-200',
};
export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        STATUS_TONE[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
export const categoryLabel = (t: { category: string; customCategory?: string }) =>
  t.category === 'Other' && t.customCategory ? `Other: ${t.customCategory}` : t.category;
