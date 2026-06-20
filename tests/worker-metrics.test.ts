import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchMetrics } from '@/lib/worker-metrics';
import { ApiClientError } from '@/lib/api-errors';

describe('fetchMetrics', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ cpuPct: 30, memPct: 50, diskPct: 70, updatedAt: '2026-06-18T00:00:00Z' }),
    });
    const data = await fetchMetrics('worker-1');
    expect(data).toEqual({ cpuPct: 30, memPct: 50, diskPct: 70, updatedAt: '2026-06-18T00:00:00Z' });
  });

  it('returns null on 404 (no metrics endpoint)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    const data = await fetchMetrics('ghost');
    expect(data).toBeNull();
  });

  it('throws ApiClientError on non-404 errors', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: () => Promise.resolve({ error: { code: 'UNAVAILABLE', message: 'unavailable' } }),
      text: () => Promise.resolve('unavailable'),
      clone() { return this; },
    });
    await expect(fetchMetrics('worker-2')).rejects.toBeInstanceOf(ApiClientError);
  });

  it('encodes special characters in worker name', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) });
    await fetchMetrics('worker with space/斜杠');
    expect(fetchMock).toHaveBeenCalledWith('/api/hiclaw/workers/worker%20with%20space%2F%E6%96%9C%E6%9D%A0/metrics', { cache: 'no-store' });
  });
});
