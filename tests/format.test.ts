import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatPct, pctBarWidth, pctColorClass, pctTextClass, timeAgo } from '@/lib/format';

afterEach(() => {
  vi.useRealTimers();
});

describe('formatPct', () => {
  it('returns the dash placeholder for null/undefined', () => {
    expect(formatPct(null)).toBe('–');
    expect(formatPct(undefined)).toBe('–');
  });

  it('rounds to integer percent', () => {
    expect(formatPct(33.6)).toBe('34%');
    expect(formatPct(0)).toBe('0%');
    expect(formatPct(100)).toBe('100%');
  });
});

describe('pctColorClass / pctTextClass', () => {
  it('keeps three thresholds consistent for the bar and text variants', () => {
    const cases: Array<[number | null, string, string]> = [
      [null, 'bg-muted-foreground/30', 'text-muted-foreground'],
      [50, 'bg-emerald-500', 'text-emerald-500'],
      [69, 'bg-emerald-500', 'text-emerald-500'],
      [70, 'bg-amber-500', 'text-amber-500'],
      [89, 'bg-amber-500', 'text-amber-500'],
      [90, 'bg-rose-500', 'text-rose-500'],
    ];
    for (const [v, expectedColor, expectedText] of cases) {
      expect(pctColorClass(v)).toBe(expectedColor);
      expect(pctTextClass(v)).toBe(expectedText);
    }
  });
});

describe('pctBarWidth', () => {
  it('clamps to [2, 100] and stringifies with a percent sign', () => {
    expect(pctBarWidth(0)).toBe('2%');
    expect(pctBarWidth(120)).toBe('100%');
    expect(pctBarWidth(-10)).toBe('2%');
    expect(pctBarWidth(50)).toBe('50%');
    expect(pctBarWidth(null)).toBe('0%');
  });
});

describe('timeAgo', () => {
  it('returns 尚未采集 for missing or unparseable input', () => {
    expect(timeAgo(undefined)).toBe('尚未采集');
    expect(timeAgo(null)).toBe('尚未采集');
    expect(timeAgo('not-a-date')).toBe('尚未采集');
  });

  it('uses a deterministic "now" so it can be unit-tested', () => {
    const now = Date.parse('2026-06-17T12:00:00Z');
    expect(timeAgo('2026-06-17T12:00:00Z', now)).toBe('0 秒前');
    expect(timeAgo('2026-06-17T11:59:30Z', now)).toBe('30 秒前');
    expect(timeAgo('2026-06-17T11:55:00Z', now)).toBe('5 分钟前');
    expect(timeAgo('2026-06-17T10:00:00Z', now)).toBe('2 小时前');
    expect(timeAgo('2026-06-15T12:00:00Z', now)).toBe('2 天前');
  });

  it('falls back to 尚未采集 for future timestamps', () => {
    const now = Date.parse('2026-06-17T12:00:00Z');
    expect(timeAgo('2026-06-17T13:00:00Z', now)).toBe('尚未采集');
  });
});
