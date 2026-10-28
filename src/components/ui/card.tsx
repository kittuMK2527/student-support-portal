import * as React from 'react';
import { cn } from '@/lib/utils';
export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)}
    {...p}
  />
);
export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 p-5', className)} {...p} />
);
export const CardTitle = ({
  className,
  children,
  ...p
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn('font-semibold leading-none tracking-tight', className)} {...p}>
    {children}
  </h2>
);
export const CardDescription = ({
  className,
  ...p
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-muted-foreground', className)} {...p} />
);
export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-5 pt-0', className)} {...p} />
);
