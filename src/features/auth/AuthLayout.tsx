import type { ReactNode } from 'react';
import { LifeBuoy } from 'lucide-react';
import DemoGuide from '@/features/demo/DemoGuide';

export default function AuthLayout({
  title,
  subtitle,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-start justify-center px-4 py-10 sm:items-center">
      <div className={wide ? 'w-full max-w-xl' : 'w-full max-w-md'}>
        <div className="mb-6 flex items-center gap-2 text-primary">
          <LifeBuoy className="size-6" aria-hidden />
          <span className="font-semibold">Student Support Portal</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        <DemoGuide inline />
      </div>
    </div>
  );
}
