'use client';

import { Cpu, MemoryStick, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkerMetrics } from '@/lib/worker-metrics';

interface MetricsMiniCardProps {
  metrics: WorkerMetrics | null | undefined;
  loading: boolean;
  className?: string;
}

function formatPct(value: number | null): string {
  if (value === null || value === undefined) return '–';
  return `${value.toFixed(0)}%`;
}

function valueColor(pct: number | null): string {
  if (pct === null || pct === undefined) return 'text-muted-foreground';
  if (pct >= 90) return 'text-rose-500';
  if (pct >= 70) return 'text-amber-500';
  return 'text-emerald-500';
}

interface MetricCellProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | null;
  loading: boolean;
}

function MetricCell({ icon: Icon, label, value, loading }: MetricCellProps) {
  return (
    <div className="flex flex-col items-center min-w-0">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="w-3 h-3" />
        <span>{label}</span>
      </div>
      <span
        className={cn(
          'text-xs font-mono tabular-nums font-semibold',
          loading ? 'text-muted-foreground/40' : valueColor(value),
        )}
      >
        {loading ? '…' : formatPct(value)}
      </span>
    </div>
  );
}

/**
 * Compact 3-cell resource bar (CPU / memory / disk) shown at the bottom
 * of each worker card. Shows `–` placeholders when the controller does
 * not yet expose a metrics endpoint.
 */
export function MetricsMiniCard({ metrics, loading, className }: MetricsMiniCardProps) {
  return (
    <div className={cn('flex items-center justify-between gap-2 pt-2 border-t border-border/40', className)}>
      <MetricCell icon={Cpu} label="CPU" value={metrics?.cpuPct ?? null} loading={loading} />
      <MetricCell icon={MemoryStick} label="内存" value={metrics?.memPct ?? null} loading={loading} />
      <MetricCell icon={HardDrive} label="磁盘" value={metrics?.diskPct ?? null} loading={loading} />
    </div>
  );
}
