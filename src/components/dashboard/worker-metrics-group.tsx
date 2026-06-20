'use client';

import { Cpu, MemoryStick, HardDrive, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useWorkerMetrics } from '@/hooks/use-worker-metrics';
import { isSyntheticWorkerMetrics } from '@/lib/worker-metrics';
import { formatPct, pctBarWidth, pctColorClass, pctTextClass, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

interface MetricsGroupProps {
  workerName: string;
  className?: string;
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
        <span className={cn('text-xl font-mono tabular-nums font-bold', pctTextClass(pct))}>
          {loading ? '…' : formatPct(pct)}
        </span>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-muted-foreground/15 overflow-hidden">
        <div className={cn('h-full transition-all duration-300', pctColorClass(pct))} style={{ width: pctBarWidth(pct) }} />
      </div>
    </div>
  );
}

function MetricsFooter({ updatedAt, synthetic }: { updatedAt: string | undefined; synthetic: boolean }) {
  if (synthetic) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400">
          估算
        </Badge>
        <p className="text-[10px] text-muted-foreground">当前 Controller 未返回原生 metrics，已展示稳定估算值</p>
      </div>
    );
  }
  return <p className="text-[10px] text-muted-foreground mt-2">更新于 {timeAgo(updatedAt)}</p>;
}

export function MetricsGroup({ workerName, className }: MetricsGroupProps) {
  const { data, isLoading, isError } = useWorkerMetrics(workerName, { refetchInterval: 10_000 });
  if (isError) {
    return (
      <div className={cn('rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 flex items-start gap-2', className)}>
        <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-rose-600 dark:text-rose-400">
          无法获取资源指标，请检查 HiClaw Controller 连接状态。
        </p>
      </div>
    );
  }
  const synthetic = isSyntheticWorkerMetrics(data);
  return (
    <div className={className}>
      <div className="grid grid-cols-3 gap-2">
        <MetricTile icon={Cpu} label="CPU" pct={data?.cpuPct ?? null} loading={isLoading} />
        <MetricTile icon={MemoryStick} label="内存" pct={data?.memPct ?? null} loading={isLoading} />
        <MetricTile icon={HardDrive} label="磁盘" pct={data?.diskPct ?? null} loading={isLoading} />
      </div>
      <MetricsFooter updatedAt={data?.updatedAt} synthetic={synthetic} />
    </div>
  );
}
