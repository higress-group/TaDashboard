import { describe, it, expect } from 'vitest';
import { extractPhaseTimeline, isPhaseEvent } from '@/lib/phase-timeline';

describe('extractPhaseTimeline', () => {
  it('extracts events with type containing "phase"', () => {
    const events = [
      { ts: '2026-06-17T00:00:00Z', type: 'phase_changed', message: 'pending -> running' },
    ];
    const result = extractPhaseTimeline(events);
    expect(result).toHaveLength(1);
    expect(result[0].toPhase).toBe('Running');
  });

  it('extracts events with phase field', () => {
    const events = [
      { ts: '2026-06-17T00:01:00Z', type: 'status', phase: 'Failed', message: 'crashed' },
    ];
    const result = extractPhaseTimeline(events);
    expect(result).toHaveLength(1);
    expect(result[0].toPhase).toBe('Failed');
    expect(result[0].reason).toBe('crashed');
  });

  it('extracts events with message containing phase', () => {
    const events = [
      { ts: '2026-06-17T00:02:00Z', type: 'log', message: 'phase changed to Sleeping' },
    ];
    const result = extractPhaseTimeline(events);
    expect(result).toHaveLength(1);
    expect(result[0].toPhase).toBe('Sleeping');
  });

  it('returns entries sorted by ts descending', () => {
    const events = [
      { ts: '2026-06-17T00:00:00Z', type: 'phase', phase: 'Running' },
      { ts: '2026-06-17T00:02:00Z', type: 'phase', phase: 'Failed' },
      { ts: '2026-06-17T00:01:00Z', type: 'phase', phase: 'Sleeping' },
    ];
    const result = extractPhaseTimeline(events);
    expect(result.map((e) => e.toPhase)).toEqual(['Failed', 'Sleeping', 'Running']);
  });

  it('returns empty array for empty input', () => {
    expect(extractPhaseTimeline([])).toEqual([]);
  });

  it('ignores non-phase events', () => {
    const events = [
      { ts: '2026-06-17T00:00:00Z', type: 'http_request', message: 'GET /foo' },
      { ts: '2026-06-17T00:01:00Z', type: 'phase', phase: 'Running' },
    ];
    const result = extractPhaseTimeline(events);
    expect(result).toHaveLength(1);
  });
});

describe('isPhaseEvent', () => {
  it('returns true for matching types', () => {
    expect(isPhaseEvent({ type: 'phase' })).toBe(true);
    expect(isPhaseEvent({ type: 'phase_changed' })).toBe(true);
  });
  it('returns true when phase field is a valid WorkerPhase', () => {
    expect(isPhaseEvent({ phase: 'Failed' })).toBe(true);
    expect(isPhaseEvent({ phase: 'Random' })).toBe(false);
  });
  it('returns true when message contains "phase"', () => {
    expect(isPhaseEvent({ message: 'phase changed to Ready' })).toBe(true);
    expect(isPhaseEvent({ message: 'normal log' })).toBe(false);
  });
});
