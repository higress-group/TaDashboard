'use client';

import { memo } from 'react';
import { Cpu, MemoryStick, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPct, pctTextClass } from '@/lib/format';
import type { WorkerMetrics } from '@/lib/worker-metrics';

interface MetricsMiniCardProps {
  metrics: WorkerMetrics | null | undefined;
  loading: boolean;
  className?: string;
}

interface MetricCellProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | null;
  loading: boolean;
}

const MetricCell = memo(function MetricCell({ icon: Icon, label, value, loading }: MetricCellProps) {
  return (
    <div className="flex flex-col items-center min-w-0">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="w-3 h-3" />
        <span>{label}</span>
      </div>
      <span className={cn('text-xs font-mono tabular-nums font-semibold', loading ? 'text-muted-foreground/40' : pctTextClass(value))}>
        {loading ? '…' : formatPct(value)}
      </span>
    </div>
  );
});

function MetricsMiniCardImpl({ metrics, loading, className }: MetricsMiniCardProps) {
  return (
    <div className={cn('flex items-center justify-between gap-2 pt-2 border-t border-border/40', className)}>
      <MetricCell icon={Cpu} label="CPU" value={metrics?.cpuPct ?? null} loading={loading} />
      <MetricCell icon={MemoryStick} label="内存" value={metrics?.memPct ?? null} loading={loading} />
      <MetricCell icon={HardDrive} label="磁盘" value={metrics?.diskPct ?? null} loading={loading} />
    </div>
  );
}

// Rendered once per worker in the table. memo skips work when a
// single worker's metrics update doesn't affect the others.
export const MetricsMiniCard = memo(MetricsMiniCardImpl);
