import type { WorkerPhase } from './hiclaw-api';

export interface PhaseTimelineEntry {
  ts: string;
  fromPhase: WorkerPhase | null;
  toPhase: WorkerPhase;
  reason: string;
}

const VALID_PHASES: ReadonlySet<WorkerPhase> = new Set<WorkerPhase>([
  'Pending',
  'Running',
  'Sleeping',
  'Updating',
  'Stopped',
  'Failed',
  'Ready',
]);

function asWorkerPhase(value: unknown): WorkerPhase | null {
  if (typeof value !== 'string') return null;
  if (VALID_PHASES.has(value as WorkerPhase)) return value as WorkerPhase;
  const lower = value.toLowerCase();
  for (const phase of VALID_PHASES) {
    if (phase.toLowerCase() === lower) return phase;
  }
  return null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function isPhaseEvent(event: { type?: string; message?: string; [k: string]: unknown }): boolean {
  const type = asString(event.type).toLowerCase();
  if (type.includes('phase')) return true;
  if (asWorkerPhase((event as Record<string, unknown>).phase) !== null) return true;
  const message = asString(event.message).toLowerCase();
  return message.includes('phase');
}

function extractToPhase(event: Record<string, unknown>): WorkerPhase | null {
  const direct = asWorkerPhase(event.phase);
  if (direct) return direct;
  const message = asString(event.message);
  const match = message.match(/phase(?:\s+changed)?\s+(?:to\s+)?(\w+)/i);
  if (match) {
    return asWorkerPhase(match[1]);
  }
  const arrowMatch = message.match(/(\w+)\s*(?:->|→|to)\s*(\w+)/);
  if (arrowMatch) {
    const to = asWorkerPhase(arrowMatch[2]);
    if (to) return to;
  }
  const meta = event.metadata as Record<string, unknown> | undefined;
  if (meta) {
    const metaPhase = asWorkerPhase(meta.phase) ?? asWorkerPhase((meta as Record<string, unknown>).toPhase);
    if (metaPhase) return metaPhase;
  }
  return null;
}

function extractFromPhase(event: Record<string, unknown>): WorkerPhase | null {
  const meta = event.metadata as Record<string, unknown> | undefined;
  if (meta) {
    const from = asWorkerPhase((meta as Record<string, unknown>).fromPhase);
    if (from) return from;
  }
  const message = asString(event.message);
  const match = message.match(/(\w+)\s*(?:->|→|to)\s*(\w+)/);
  if (match) {
    const a = asWorkerPhase(match[1]);
    const b = asWorkerPhase(match[2]);
    return a && b ? a : null;
  }
  return null;
}

function extractReason(event: Record<string, unknown>): string {
  const reason = (event as Record<string, unknown>).reason;
  if (typeof reason === 'string' && reason) return reason;
  const meta = event.metadata as Record<string, unknown> | undefined;
  if (meta && typeof meta.reason === 'string') return meta.reason;
  return asString(event.message);
}

/**
 * Convert a raw event stream into phase-change timeline entries,
 * sorted by timestamp descending. Non-phase events are filtered out.
 */
export function extractPhaseTimeline(
  events: Array<{ ts?: string; type?: string; message?: string; [k: string]: unknown }>,
): PhaseTimelineEntry[] {
  const result: PhaseTimelineEntry[] = [];
  for (const raw of events) {
    if (!isPhaseEvent(raw)) continue;
    const to = extractToPhase(raw as Record<string, unknown>);
    if (!to) continue;
    result.push({
      ts: asString(raw.ts) || new Date().toISOString(),
      fromPhase: extractFromPhase(raw as Record<string, unknown>),
      toPhase: to,
      reason: extractReason(raw as Record<string, unknown>),
    });
  }
  result.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  return result;
}
