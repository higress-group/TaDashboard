'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ModernGridProps {
  children: ReactNode;
  cols?: 1 | 2 | 3 | 4;
  gap?: 'tight' | 'normal' | 'loose';
  className?: string;
}

const COLS: Record<NonNullable<ModernGridProps['cols']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
};

const GAP: Record<NonNullable<ModernGridProps['gap']>, string> = {
  tight: 'gap-2',
  normal: 'gap-3',
  loose: 'gap-4',
};

export function ModernGrid({ children, cols = 3, gap = 'normal', className }: ModernGridProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
      }}
      className={cn('grid', COLS[cols], GAP[gap], className)}
    >
      {children}
    </motion.div>
  );
}