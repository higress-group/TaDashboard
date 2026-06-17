import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMetrics } from '@/lib/worker-metrics';

describe('fetchMetrics', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns parsed metrics on 200', async () => {
    const payload = { cpuPct: 12.5, memPct: 33.3, diskPct: 66.6, updatedAt: '2026-06-17T00:00:00Z' };
    global.fetch = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
    const result = await fetchMetrics('worker-a');
    expect(result).toEqual(payload);
  });

  it('returns null on 404', async () => {
    global.fetch = vi.fn(async () => new Response('not found', { status: 404 })) as unknown as typeof fetch;
    const result = await fetchMetrics('worker-b');
    expect(result).toBeNull();
  });

  it('throws on 5xx', async () => {
    global.fetch = vi.fn(async () => new Response('boom', { status: 500 })) as unknown as typeof fetch;
    await expect(fetchMetrics('worker-c')).rejects.toMatchObject({ status: 500 });
  });

  it('throws on 401', async () => {
    global.fetch = vi.fn(async () => new Response('unauthorized', { status: 401 })) as unknown as typeof fetch;
    await expect(fetchMetrics('worker-d')).rejects.toMatchObject({ status: 401 });
  });

  it('encodes worker name', async () => {
    const spy = vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    global.fetch = spy as unknown as typeof fetch;
    await fetchMetrics('worker with/slash');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('worker with/slash')), expect.anything());
  });
});
