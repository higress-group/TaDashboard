'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SurfaceShellProps extends ComponentPropsWithoutRef<'div'> {
  contentClassName?: string;
  glass?: boolean;
  hover?: boolean;
  selected?: boolean;
}

export function SurfaceShell({
  children,
  className,
  contentClassName,
  glass = true,
  hover = false,
  selected = false,
  ...rest
}: SurfaceShellProps) {
  return (
    <Card
      className={cn(
        glass && 'glass-card',
        hover && 'hover-lift',
        selected && 'ring-2 ring-orange-500/50',
        className,
      )}
      {...rest}
    >
      <CardContent className={cn('p-4', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

interface SurfaceEmptyStateProps {
  icon?: ReactNode;
  message: string;
  action?: ReactNode;
  className?: string;
}

export function SurfaceEmptyState({ icon, message, action, className }: SurfaceEmptyStateProps) {
  return (
    <SurfaceShell className={className} contentClassName="p-12 text-center">
      {icon && <div className="mx-auto mb-4 text-muted-foreground">{icon}</div>}
      <p className="text-muted-foreground">{message}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </SurfaceShell>
  );
}

interface SurfaceSkeletonGridProps {
  count?: number;
  cols?: 1 | 2 | 3 | 4;
  rows?: number;
  className?: string;
}

const COL_CLASS: Record<NonNullable<SurfaceSkeletonGridProps['cols']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
};

export function SurfaceSkeletonGrid({ count = 6, cols = 3, rows = 3, className }: SurfaceSkeletonGridProps) {
  return (
    <div className={cn('grid gap-4', COL_CLASS[cols], className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SurfaceShell key={i} contentClassName="p-4 space-y-3">
          {Array.from({ length: rows }).map((__, j) => (
            <div key={j} className={`h-4 w-${j === 0 ? 32 : j === 1 ? 24 : 20} rounded shimmer`} />
          ))}
        </SurfaceShell>
      ))}
    </div>
  );
}
