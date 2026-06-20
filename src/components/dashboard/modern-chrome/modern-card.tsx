'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ModernCardProps extends HTMLAttributes<HTMLDivElement> {
  heading?: ReactNode;
  subheading?: ReactNode;
  actions?: ReactNode;
  accent?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  density?: 'comfortable' | 'compact';
  animated?: boolean;
}

const ACCENT_RING: Record<NonNullable<ModernCardProps['accent']>, string> = {
  default: 'ring-border/40',
  success: 'ring-emerald-500/30',
  warning: 'ring-amber-500/30',
  danger: 'ring-rose-500/40',
  info: 'ring-cyan-500/30',
};

export const ModernCard = forwardRef<HTMLDivElement, ModernCardProps>(function ModernCard(
  { heading, subheading, actions, accent = 'default', density = 'comfortable', animated = true, className, children, ...rest },
  ref,
) {
  const pad = density === 'compact' ? 'p-3' : 'p-4';
  const gap = density === 'compact' ? 'gap-2' : 'gap-3';
  const Wrapper = animated ? motion.div : 'div';
  const motionProps = animated
    ? {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.18, ease: 'easeOut' },
      }
    : {};
  return (
    // @ts-expect-error - dynamic component (motion.div | div) typing
    <Wrapper
      ref={ref}
      className={cn(
        'rounded-2xl border border-border/60 bg-card/80 backdrop-blur-md shadow-sm ring-1',
        ACCENT_RING[accent],
        pad,
        gap,
        'flex flex-col',
        className,
      )}
      {...(motionProps as Record<string, unknown>)}
      {...rest}
    >
      {(heading || subheading || actions) && (
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {heading && <h3 className="text-sm font-semibold leading-tight text-foreground">{heading}</h3>}
            {subheading && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{subheading}</p>}
          </div>
          {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn('flex-1 min-h-0', density === 'compact' ? 'text-xs' : 'text-sm')}>{children}</div>
    </Wrapper>
  );
});