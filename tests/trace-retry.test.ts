import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTraceRetry } from '@/hooks/use-trace-retry';

describe('createTraceRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries with 1s delay on first failure', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ events: [] });
    const retry = createTraceRetry(fetcher);
    const p = retry.run();
    await vi.advanceTimersByTimeAsync(1000);
    await p;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('retries with 2s delay on second failure', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockResolvedValueOnce({ events: [] });
    const retry = createTraceRetry(fetcher);
    const p = retry.run();
    await vi.advanceTimersByTimeAsync(3000);
    await p;
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('retries with 4s delay on third failure', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockRejectedValueOnce(new Error('e3'))
      .mockResolvedValueOnce({ events: [] });
    const retry = createTraceRetry(fetcher);
    const p = retry.run();
    await vi.advanceTimersByTimeAsync(7000);
    await p;
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('stops retrying after cancel() and surfaces last error', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('always-fail'));
    const retry = createTraceRetry(fetcher);
    const p = retry.run().catch(() => undefined);
    vi.advanceTimersByTime(100);
    retry.cancel();
    await p;
    expect(retry.getState().lastError).toBeInstanceOf(Error);
    expect(fetcher.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('pause prevents retries; resume allows next run() to proceed', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ events: [] });
    const retry = createTraceRetry(fetcher);
    const p1 = retry.run().catch(() => undefined);
    retry.pause();
    await vi.advanceTimersByTimeAsync(2000);
    await p1;
    expect(fetcher).toHaveBeenCalledTimes(1);
    retry.resume();
    const p2 = retry.run();
    await vi.advanceTimersByTimeAsync(0);
    await p2;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
