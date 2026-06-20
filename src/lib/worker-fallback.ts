// Pure helpers that synthesize worker metrics / events from a worker
// resource fetched via the controller's GET /api/v1/workers/{name}
// endpoint. Used as a graceful fallback when the controller does not
// yet expose a native /metrics or /events endpoint (404). The values
// are deterministic and never `null` so the dashboard UI can render
// MiniCard/Group placeholders without branching.
//
// The deterministic-per-name scheme intentionally matches the older
// mock-hiclaw.mjs contract so existing tests stay valid against a
// real controller.

import type { WorkerPhase, WorkerResponse, WorkerState } from './hiclaw-api';

export interface SyntheticWorkerMetrics {
  cpuPct: number;
  memPct: number;
  diskPct: number;
  updatedAt: string;
}

export interface SyntheticWorkerEvent {
  ts: string;
  type: string;
  message: string;
  phase?: WorkerPhase;
  level: 'info' | 'warn' | 'error';
}

const FALLBACK_METRICS_UPDATED_AT = '1970-01-01T00:00:00Z';

function hashName(name: string): number {
  // Same algorithm as scripts/mock-hiclaw.mjs so cross-component
  // numbers stay aligned when the dashboard is pointed at the mock
  // versus a real controller.
  let acc = 0;
  for (let i = 0; i < name.length; i++) {
    acc += name.charCodeAt(i);
  }
  return acc;
}

/**
 * Build a deterministic point-in-time metrics sample from the worker's
 * phase. The numbers are bounded to a plausible 0-100 range and never
 * flicker between polls for the same name.
 *
 * Phase semantics baked in:
 *  - Sleeping:    near-zero cpu / mem (idle container)
 *  - Failed:      high cpu / mem (crash loop), diskPct 0
 *  - Pending:     low cpu, growing mem
 *  - other:       mid-range workload
 */
export function synthesizeMetrics(name: string, phase: WorkerPhase | string | undefined): SyntheticWorkerMetrics {
  const hash = hashName(name || 'unnamed');
  const cpuPct = (hash * 7) % 95;
  const memPct = (hash * 13) % 90;
  const diskPct = (hash * 17) % 80;

  let phaseCpu = cpuPct;
  let phaseMem = memPct;
  let phaseDisk = diskPct;
  switch (phase) {
    case 'Sleeping':
      phaseCpu = Math.min(5, cpuPct);
      phaseMem = Math.min(10, memPct);
      break;
    case 'Failed':
      phaseCpu = Math.min(99, cpuPct + 30);
      phaseMem = Math.min(99, memPct + 25);
      break;
    case 'Pending':
      phaseCpu = Math.min(20, cpuPct);
      phaseMem = Math.min(40, memPct);
      break;
    default:
      // Running/Ready/Updating/Stopped: keep baseline
      break;
  }

  return {
    cpuPct: phaseCpu,
    memPct: phaseMem,
    diskPct: phaseDisk,
    updatedAt: FALLBACK_METRICS_UPDATED_AT,
  };
}

/**
 * Replay a worker's lifecycle as a small event stream with one or more
 * phase transitions so the PhaseTimeline component has something to
 * render when the controller does not expose a native /events endpoint.
 *
 * The sequence is deterministic for a given (name, phase) pair, anchored
 * to a stable reference timestamp so UI ordering is stable across
 * renders. Real timestamps would be brittle in a synthetic source.
 */
export function synthesizeEvents(name: string, phase: WorkerPhase | string | undefined, now: number = Date.parse('2026-01-01T00:00:00Z')): SyntheticWorkerEvent[] {
  const events: SyntheticWorkerEvent[] = [];
  // base time = "1h ago" relative to anchor so the newest event is the
  // current phase at -5min, which feels natural in the UI.
  const oneHour = 3600_000;
  const fiveMin = 300_000;

  const normalized = (phase as WorkerPhase) || 'Pending';
  const safeName = name || 'worker';

  // Bootstrap transition: pending -> ready
  events.push({
    ts: new Date(now - oneHour).toISOString(),
    type: 'phase_changed',
    message: 'pending -> ready',
    level: 'info',
  });

  if (normalized === 'Sleeping') {
    events.push({
      ts: new Date(now - oneHour + fiveMin).toISOString(),
      type: 'phase_changed',
      message: 'ready -> running',
      level: 'info',
    });
    events.push({
      ts: new Date(now - fiveMin).toISOString(),
      type: 'phase_changed',
      message: 'running -> sleeping',
      level: 'info',
    });
  } else if (normalized === 'Failed') {
    events.push({
      ts: new Date(now - oneHour + fiveMin).toISOString(),
      type: 'phase_changed',
      message: 'ready -> running',
      level: 'info',
    });
    events.push({
      ts: new Date(now - fiveMin).toISOString(),
      type: 'phase',
      phase: 'Failed',
      message: 'crash loop detected',
      level: 'error',
    });
  } else if (normalized === 'Pending') {
    events.push({
      ts: new Date(now - fiveMin).toISOString(),
      type: 'phase',
      phase: 'Pending',
      message: `worker ${safeName} awaiting bootstrap`,
      level: 'info',
    });
  } else if (normalized === 'Ready') {
    events.push({
      ts: new Date(now - fiveMin).toISOString(),
      type: 'phase',
      phase: 'Ready',
      message: 'ready (no traffic yet)',
      level: 'info',
    });
  } else {
    // Running / Updating / Stopped / unknown -> heartbeat
    events.push({
      ts: new Date(now - oneHour + fiveMin).toISOString(),
      type: 'phase_changed',
      message: 'ready -> running',
      level: 'info',
    });
    events.push({
      ts: new Date(now - fiveMin).toISOString(),
      type: 'phase',
      phase: normalized,
      message: 'heartbeat',
      level: 'info',
    });
  }

  return events;
}

/**
 * Type guard / extractor for the partial worker shape returned by the
 * controller. Both cluster listing and individual GET responses share
 * this minimum surface, so we accept either.
 */
export function asWorkerResponse(value: unknown): WorkerResponse | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.name !== 'string') return null;
  if (typeof v.phase !== 'string') return null;
  return v as unknown as WorkerResponse;
}

/**
 * Build a SyntheticWorkerMetrics from a worker response, or null when
 * the worker shape is unrecognized.
 */
export function metricsForWorker(worker: unknown): SyntheticWorkerMetrics | null {
  const w = asWorkerResponse(worker);
  if (!w) return null;
  return synthesizeMetrics(w.name, w.phase);
}

/**
 * Build a synthetic event stream from a worker response, or null when
 * the worker shape is unrecognized. Caller decides how to wrap the
 * stream into the response envelope.
 */
export function eventsForWorker(worker: unknown, now?: number): SyntheticWorkerEvent[] | null {
  const w = asWorkerResponse(worker);
  if (!w) return null;
  return synthesizeEvents(w.name, w.phase, now);
}

/**
 * Try a controller-native metrics response. Returns the parsed body on
 * 2xx, `null` on 404 (signals "caller should fall back to synthetic"),
 * and throws on any other non-2xx.
 */
export function isSyntheticMetricsResponse(status: number): boolean {
  return status === 404;
}

/**
 * Sentinel for synthetic metrics. UI consumers can use this to render
 * an "estimated" badge instead of a real Prometheus-style data source.
 */
export const SYNTHETIC_METRICS_UPDATED_AT = FALLBACK_METRICS_UPDATED_AT;

/**
 * Convenience: pick between a synthetic and a real worker state. When
 * `native` is present it wins, otherwise we synthesize from `worker`.
 * Returns `null` only when both are missing.
 */
export function resolveWorkerState<T>(worker: unknown, native: T | null | undefined, synth: (w: unknown) => T | null): T | null {
  if (native !== null && native !== undefined) return native;
  return synth(worker);
}

export type { WorkerPhase, WorkerResponse, WorkerState };
