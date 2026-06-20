import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchWorkerEvents } from '@/lib/worker-events';

describe('fetchWorkerEvents', () => {
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
      json: () => Promise.resolve({ events: [{ ts: '2026-06-18T00:00:00Z', type: 'phase', message: 'phase changed to Running' }] }),
    });
    const data = await fetchWorkerEvents('worker-1');
    expect(data).toEqual({ events: [{ ts: '2026-06-18T00:00:00Z', type: 'phase', message: 'phase changed to Running' }] });
    expect(fetchMock).toHaveBeenCalledWith('/api/hiclaw/workers/worker-1/events', { cache: 'no-store' });
  });

  it('returns null on 404 (no events endpoint)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    const data = await fetchWorkerEvents('ghost');
    expect(data).toBeNull();
  });

  it('throws on non-404 errors', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' });
    await expect(fetchWorkerEvents('worker-2')).rejects.toThrow('Trace fetch failed: 500');
  });

  it('encodes special characters in worker name', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) });
    await fetchWorkerEvents('worker with space/斜杠');
    expect(fetchMock).toHaveBeenCalledWith('/api/hiclaw/workers/worker%20with%20space%2F%E6%96%9C%E6%9D%A0/events', { cache: 'no-store' });
  });
});
