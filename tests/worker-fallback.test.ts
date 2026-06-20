import { describe, it, expect } from 'vitest';
import {
  asWorkerResponse,
  metricsForWorker,
  eventsForWorker,
  synthesizeMetrics,
  synthesizeEvents,
  isSyntheticMetricsResponse,
  resolveWorkerState,
  SYNTHETIC_METRICS_UPDATED_AT,
  type SyntheticWorkerEvent,
  type SyntheticWorkerMetrics,
} from '@/lib/worker-fallback';

describe('asWorkerResponse', () => {
  it('returns null for null/undefined/non-object input', () => {
    expect(asWorkerResponse(null)).toBeNull();
    expect(asWorkerResponse(undefined)).toBeNull();
    expect(asWorkerResponse('worker')).toBeNull();
    expect(asWorkerResponse(42)).toBeNull();
    expect(asWorkerResponse([])).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    expect(asWorkerResponse({ name: 'a' })).toBeNull();
    expect(asWorkerResponse({ phase: 'Running' })).toBeNull();
    expect(asWorkerResponse({})).toBeNull();
  });

  it('returns the worker object when name + phase are present', () => {
    const w = { name: 'alice', phase: 'Running' };
    expect(asWorkerResponse(w)).toEqual(w);
  });
});

describe('synthesizeMetrics', () => {
  it('returns bounded 0..100 values for every phase', () => {
    const phases = ['Pending', 'Running', 'Sleeping', 'Failed', 'Ready', 'Updating', 'Stopped', 'unknown'];
    for (const phase of phases) {
      const m = synthesizeMetrics('alice', phase);
      expect(m.cpuPct).toBeGreaterThanOrEqual(0);
      expect(m.cpuPct).toBeLessThanOrEqual(100);
      expect(m.memPct).toBeGreaterThanOrEqual(0);
      expect(m.memPct).toBeLessThanOrEqual(100);
      expect(m.diskPct).toBeGreaterThanOrEqual(0);
      expect(m.diskPct).toBeLessThanOrEqual(100);
    }
  });

  it('is deterministic for the same name + phase', () => {
    const a = synthesizeMetrics('alice', 'Running');
    const b = synthesizeMetrics('alice', 'Running');
    expect(a).toEqual(b);
  });

  it('produces different samples for different names', () => {
    const a = synthesizeMetrics('alice', 'Running');
    const b = synthesizeMetrics('bob', 'Running');
    expect(a).not.toEqual(b);
  });

  it('flattens Sleeping phase to low cpu/mem', () => {
    const m = synthesizeMetrics('zzz-sleeping-worker', 'Sleeping');
    expect(m.cpuPct).toBeLessThanOrEqual(5);
    expect(m.memPct).toBeLessThanOrEqual(10);
  });

  it('raises cpu/mem for Failed phase', () => {
    const sleeping = synthesizeMetrics('crash-worker', 'Sleeping');
    const failed = synthesizeMetrics('crash-worker', 'Failed');
    expect(failed.cpuPct).toBeGreaterThan(sleeping.cpuPct);
    expect(failed.memPct).toBeGreaterThan(sleeping.memPct);
  });

  it('includes the synthetic sentinel updatedAt', () => {
    const m = synthesizeMetrics('alice', 'Running');
    expect(m.updatedAt).toBe(SYNTHETIC_METRICS_UPDATED_AT);
  });

  it('handles empty / undefined name and phase gracefully', () => {
    const a = synthesizeMetrics('', undefined);
    const b = synthesizeMetrics('alice', undefined);
    expect(a.cpuPct).toBeGreaterThanOrEqual(0);
    expect(a.memPct).toBeGreaterThanOrEqual(0);
    expect(b.cpuPct).toBeGreaterThanOrEqual(0);
    // Empty name still produces stable, bounded values
    const c = synthesizeMetrics('', undefined);
    expect(a).toEqual(c);
  });
});

describe('synthesizeEvents', () => {
  const ANCHOR = Date.parse('2026-01-01T00:00:00Z');

  it('always starts with a pending -> ready transition', () => {
    for (const phase of ['Pending', 'Running', 'Sleeping', 'Failed', 'Ready', 'Stopped', undefined]) {
      const events = synthesizeEvents('alice', phase, ANCHOR);
      expect(events[0].message).toBe('pending -> ready');
      expect(events[0].ts).toBe(new Date(ANCHOR - 3600_000).toISOString());
    }
  });

  it('emits three events for Sleeping (pending->ready, ready->running, running->sleeping)', () => {
    const events = synthesizeEvents('alice', 'Sleeping', ANCHOR);
    expect(events).toHaveLength(3);
    expect(events[2].message).toBe('running -> sleeping');
    expect(events[2].level).toBe('info');
  });

  it('emits an error-level Failed transition with phase=Failed', () => {
    const events = synthesizeEvents('alice', 'Failed', ANCHOR);
    expect(events).toHaveLength(3);
    expect(events[2].phase).toBe('Failed');
    expect(events[2].level).toBe('error');
    expect(events[2].message).toContain('crash');
  });

  it('emits a heartbeat for Running / Ready / Updating / Stopped', () => {
    for (const phase of ['Running', 'Ready', 'Updating', 'Stopped']) {
      const events = synthesizeEvents('alice', phase, ANCHOR);
      // The last event is the heartbeat: type='phase' with the current phase
      const last = events[events.length - 1];
      expect(last.type).toBe('phase');
      expect(last.phase).toBe(phase);
      expect(last.level).toBe('info');
    }
  });

  it('is deterministic for the same (name, phase, anchor)', () => {
    const a = synthesizeEvents('alice', 'Running', ANCHOR);
    const b = synthesizeEvents('alice', 'Running', ANCHOR);
    expect(a).toEqual(b);
  });

  it('uses the provided anchor when supplied (so callers can pin a clock)', () => {
    const events = synthesizeEvents('alice', 'Pending', ANCHOR);
    const last = events[events.length - 1];
    // Last event must be within the last 10 minutes of the anchor
    const ts = Date.parse(last.ts);
    expect(ts).toBeGreaterThanOrEqual(ANCHOR - 600_000);
    expect(ts).toBeLessThanOrEqual(ANCHOR);
  });

  it('handles empty / undefined name', () => {
    const events = synthesizeEvents('', 'Running', ANCHOR);
    expect(events.length).toBeGreaterThan(0);
  });
});

describe('metricsForWorker / eventsForWorker (worker-shape wrappers)', () => {
  it('metricsForWorker returns null for invalid worker shapes', () => {
    expect(metricsForWorker(null)).toBeNull();
    expect(metricsForWorker({})).toBeNull();
    expect(metricsForWorker({ name: 'a' })).toBeNull();
  });

  it('metricsForWorker synthesizes from a valid worker shape', () => {
    const m = metricsForWorker({ name: 'alice', phase: 'Running' });
    expect(m).not.toBeNull();
    expect(m!.cpuPct).toBeGreaterThanOrEqual(0);
    expect(m!.updatedAt).toBe(SYNTHETIC_METRICS_UPDATED_AT);
  });

  it('eventsForWorker returns null for invalid worker shapes', () => {
    expect(eventsForWorker(null)).toBeNull();
    expect(eventsForWorker({ name: 'a' })).toBeNull();
  });

  it('eventsForWorker returns a phase event stream for valid shapes', () => {
    const events = eventsForWorker({ name: 'alice', phase: 'Sleeping' });
    expect(events).not.toBeNull();
    expect(events!.length).toBe(3);
  });
});

describe('isSyntheticMetricsResponse', () => {
  it('only signals synthetic for 404', () => {
    expect(isSyntheticMetricsResponse(404)).toBe(true);
    expect(isSyntheticMetricsResponse(200)).toBe(false);
    expect(isSyntheticMetricsResponse(401)).toBe(false);
    expect(isSyntheticMetricsResponse(500)).toBe(false);
  });
});

describe('resolveWorkerState', () => {
  it('prefers the native value when present', () => {
    const synth = () => ({ cpuPct: 0, memPct: 0, diskPct: 0, updatedAt: 'x' } as SyntheticWorkerMetrics);
    const native: SyntheticWorkerMetrics = { cpuPct: 50, memPct: 50, diskPct: 50, updatedAt: 'real' };
    expect(resolveWorkerState({}, native, synth)).toBe(native);
  });

  it('falls back to the synthetic builder when native is null', () => {
    const native: SyntheticWorkerMetrics | null = null;
    const synth = () => ({ cpuPct: 1, memPct: 2, diskPct: 3, updatedAt: 'synth' } as SyntheticWorkerMetrics);
    expect(resolveWorkerState({ name: 'x', phase: 'Running' }, native, synth)).toEqual({
      cpuPct: 1,
      memPct: 2,
      diskPct: 3,
      updatedAt: 'synth',
    });
  });

  it('falls back to the synthetic builder when native is undefined', () => {
    expect(
      resolveWorkerState<SyntheticWorkerEvent[]>({ name: 'x', phase: 'Running' }, undefined, () => [
        { ts: 't', type: 'phase', message: 'm', level: 'info' },
      ]),
    ).toHaveLength(1);
  });

  it('returns null when both native and synthetic are unavailable', () => {
    expect(
      resolveWorkerState<SyntheticWorkerEvent[]>(null, null, () => null),
    ).toBeNull();
  });
});
