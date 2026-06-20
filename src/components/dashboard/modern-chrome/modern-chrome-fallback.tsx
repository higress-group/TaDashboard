'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModernChromeFallbackProps {
  reason: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Renders a section body with the original (non-modern) chrome when the
 * user has disabled `modernChromeEnabled` or when a particular section
 * has not yet been migrated. The fallback keeps the original markup
 * intact so existing copy and layout continue to render.
 */
export function ModernChromeFallback({ reason, className, children }: ModernChromeFallbackProps) {
  return (
    <div className={cn('rounded-xl border border-dashed border-border/60 bg-muted/20 p-4', className)}>
      <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <Info className="w-3 h-3" />
        Legacy chrome · {reason}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}