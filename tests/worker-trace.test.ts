import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchWorkerEvents } from '@/lib/worker-events';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('WorkerTraceDialog fetch path', () => {
  it('returns null when the controller returns 404 (events endpoint absent)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 })) as unknown as typeof fetch;
    const result = await fetchWorkerEvents('alice');
    expect(result).toBeNull();
  });

  it('throws when the controller returns 5xx (transient failure)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('boom', { status: 503 })) as unknown as typeof fetch;
    await expect(fetchWorkerEvents('alice')).rejects.toThrow(/503/);
  });

  it('returns the parsed body on a successful 200 with `events` array', async () => {
    const body = { events: [{ ts: '2026-06-17T01:00:00Z', type: 'phase', level: 'info', message: 'woke up' }] };
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
    const result = await fetchWorkerEvents('alice');
    expect(result).not.toBeNull();
    expect(result?.events).toHaveLength(1);
    expect(result?.events?.[0].message).toBe('woke up');
  });

  it('returns the parsed body on a successful 200 with `items` array (legacy shape)', async () => {
    const body = { items: [{ ts: '2026-06-17T01:00:00Z', type: 'phase', level: 'info', message: 'hi' }] };
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
    const result = await fetchWorkerEvents('alice');
    expect(result?.items).toHaveLength(1);
  });

  it('encodes worker names with special characters in the URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;
    await fetchWorkerEvents('worker with space');
    expect(fetchMock).toHaveBeenCalledWith('/api/hiclaw/workers/worker%20with%20space/events', { cache: 'no-store' });
  });
});
