/**
 * Interface contract tests for `src/lib/typing.ts`.
 *
 * Drives the public API of the Matrix typing publisher and observer.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('typing publisher throttling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('publishes once immediately when input becomes non-empty', async () => {
    const { createTypingPublisher } = await import('@/lib/typing');
    const publisher = createTypingPublisher({ roomId: '!r:hs', intervalMs: 4000 });
    publisher.notify();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/matrix/rooms/'),
      expect.objectContaining({ method: 'PUT' }),
    );
    publisher.dispose();
  });

  it('throttles to one publish per intervalMs', async () => {
    const { createTypingPublisher } = await import('@/lib/typing');
    const publisher = createTypingPublisher({ roomId: '!r:hs', intervalMs: 4000 });
    publisher.notify();
    publisher.notify();
    publisher.notify();
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(4000);
    publisher.notify();
    expect(fetch).toHaveBeenCalledTimes(2);
    publisher.dispose();
  });

  it('stops publishing within 1s after stop()', async () => {
    const { createTypingPublisher } = await import('@/lib/typing');
    const publisher = createTypingPublisher({ roomId: '!r:hs', intervalMs: 4000 });
    publisher.notify();
    publisher.stop();
    vi.advanceTimersByTime(5000);
    publisher.notify();
    expect(fetch).toHaveBeenCalledTimes(1);
    publisher.dispose();
  });

  it('swallows fetch failures silently', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const { createTypingPublisher } = await import('@/lib/typing');
    const publisher = createTypingPublisher({ roomId: '!r:hs', intervalMs: 4000 });
    expect(() => publisher.notify()).not.toThrow();
    publisher.dispose();
  });
});

describe('typing observer staleness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-16T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops senders whose last m.typing is older than 6s', async () => {
    const { pruneStaleTypers } = await import('@/lib/typing');
    const typers = new Map<string, number>([
      ['@alice:hs', Date.now() - 7000],
      ['@bob:hs', Date.now() - 1000],
    ]);
    const pruned = pruneStaleTypers(typers, 6000);
    expect(pruned.has('@alice:hs')).toBe(false);
    expect(pruned.has('@bob:hs')).toBe(true);
  });
});