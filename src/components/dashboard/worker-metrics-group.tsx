'use client';

import { Cpu, MemoryStick, HardDrive, AlertCircle } from 'lucide-react';
import { useWorkerMetrics } from '@/hooks/use-worker-metrics';
import { cn } from '@/lib/utils';

interface MetricsGroupProps {
  workerName: string;
  className?: string;
}

function pctColor(pct: number | null): string {
  if (pct === null || pct === undefined) return 'bg-muted-foreground/30';
  if (pct >= 90) return 'bg-rose-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function formatPct(value: number | null): string {
  if (value === null || value === undefined) return '–';
  return `${value.toFixed(0)}%`;
}

function timeAgo(iso: string | undefined): string {
  if (!iso) return '尚未采集';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0 || Number.isNaN(ms)) return '尚未采集';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec} 秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`;
  return `${Math.floor(sec / 3600)} 小时前`;
}

interface MetricTileProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  pct: number | null;
  loading: boolean;
}

function MetricTile({ icon: Icon, label, pct, loading }: MetricTileProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            'text-xl font-mono tabular-nums font-bold',
            pct === null ? 'text-muted-foreground' : pct >= 90 ? 'text-rose-500' : pct >= 70 ? 'text-amber-500' : 'text-emerald-500',
          )}
        >
          {loading ? '…' : formatPct(pct)}
        </span>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-muted-foreground/15 overflow-hidden">
        <div
          className={cn('h-full transition-all duration-300', pctColor(pct))}
          style={{ width: pct === null ? '0%' : `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Detail-dialog resource metrics group. Polls every 10s (faster than
 * the list's 30s); caller should unmount when the dialog closes so
 * polling stops automatically.
 */
export function MetricsGroup({ workerName, className }: MetricsGroupProps) {
  const { data, isLoading, isError } = useWorkerMetrics(workerName, { refetchInterval: 10_000 });
  if (isError) {
    return (
      <div className={cn('rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 flex items-start gap-2', className)}>
        <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-rose-600 dark:text-rose-400">
          无法获取资源指标，请检查 HiClaw Controller 是否暴露 metrics 端点。
        </p>
      </div>
    );
  }
  return (
    <div className={className}>
      <div className="grid grid-cols-3 gap-2">
        <MetricTile icon={Cpu} label="CPU" pct={data?.cpuPct ?? null} loading={isLoading} />
        <MetricTile icon={MemoryStick} label="内存" pct={data?.memPct ?? null} loading={isLoading} />
        <MetricTile icon={HardDrive} label="磁盘" pct={data?.diskPct ?? null} loading={isLoading} />
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">更新于 {timeAgo(data?.updatedAt)}</p>
    </div>
  );
}
