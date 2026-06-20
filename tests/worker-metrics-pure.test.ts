import { describe, it, expect } from 'vitest';
import { isSyntheticWorkerMetrics } from '@/lib/worker-metrics';
import { SYNTHETIC_METRICS_UPDATED_AT } from '@/lib/worker-fallback';

describe('isSyntheticWorkerMetrics', () => {
  it('returns true when updatedAt matches the sentinel', () => {
    expect(isSyntheticWorkerMetrics({ updatedAt: SYNTHETIC_METRICS_UPDATED_AT, cpuPct: 50, memPct: 50, diskPct: 50 })).toBe(true);
  });

  it('returns false for real (non-sentinel) timestamps', () => {
    expect(isSyntheticWorkerMetrics({ updatedAt: '2026-06-18T00:00:00Z', cpuPct: 50, memPct: 50, diskPct: 50 })).toBe(false);
    expect(isSyntheticWorkerMetrics({ updatedAt: '1970-01-01T00:00:01Z', cpuPct: 50, memPct: 50, diskPct: 50 })).toBe(false);
  });

  it('returns false for null and undefined inputs', () => {
    expect(isSyntheticWorkerMetrics(null)).toBe(false);
    expect(isSyntheticWorkerMetrics(undefined)).toBe(false);
  });

  it('returns false when updatedAt is empty string', () => {
    expect(isSyntheticWorkerMetrics({ updatedAt: '', cpuPct: null, memPct: null, diskPct: null })).toBe(false);
  });

  it('handles missing cpu/mem/disk fields', () => {
    expect(isSyntheticWorkerMetrics({ updatedAt: SYNTHETIC_METRICS_UPDATED_AT })).toBe(true);
  });
});
