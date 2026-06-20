export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–';
  return `${value.toFixed(0)}%`;
}

export function pctColorClass(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return 'bg-muted-foreground/30';
  if (pct >= 90) return 'bg-rose-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function pctTextClass(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return 'text-muted-foreground';
  if (pct >= 90) return 'text-rose-500';
  if (pct >= 70) return 'text-amber-500';
  return 'text-emerald-500';
}

export function pctBarWidth(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return '0%';
  return `${Math.max(2, Math.min(100, pct))}%`;
}

export function timeAgo(iso: string | undefined | null, now: number = Date.now()): string {
  if (!iso) return '尚未采集';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '尚未采集';
  const ms = now - t;
  if (ms < 0) return '尚未采集';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec} 秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小时前`;
  return `${Math.floor(sec / 86400)} 天前`;
}
