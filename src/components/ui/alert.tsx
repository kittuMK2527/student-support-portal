import * as React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
const TONES = {
  info: ['border-sky-200 bg-sky-50 text-sky-900', Info],
  success: ['border-emerald-200 bg-emerald-50 text-emerald-900', CheckCircle2],
  error: ['border-red-200 bg-red-50 text-red-900', AlertCircle],
} as const;
export function Alert({
  tone = 'info',
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  className?: string;
  children?: React.ReactNode;
}) {
  if (!children) return null;
  const [cls, Icon] = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-2 rounded-lg border px-3 py-2.5 text-sm', cls, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
