'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface TraceRetryState {
  lastError: Error | null;
  attempt: number;
  paused: boolean;
}

export interface TraceRetryController {
  run: () => Promise<unknown>;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  getState: () => TraceRetryState;
}

const BACKOFF_MS = [1_000, 2_000, 4_000];

/**
 * Exponential-backoff retry helper for trace polling. 1s / 2s / 4s
 * delays between attempts. Cancellable mid-flight so the "重试"
 * button can interrupt the current timer and fire immediately.
 */
export function createTraceRetry(
  fetcher: () => Promise<unknown>,
): TraceRetryController {
  let lastError: Error | null = null;
  let attempt = 0;
  let paused = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    run() {
      cancelled = false;
      paused = false;
      attempt = 0;
      lastError = null;
      const execute = async (): Promise<unknown> => {
        if (cancelled) throw new Error('cancelled');
        try {
          const result = await fetcher();
          lastError = null;
          return result;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (cancelled) throw lastError;
          if (paused) {
            throw lastError;
          }
          if (attempt >= BACKOFF_MS.length) {
            throw lastError;
          }
          const delay = BACKOFF_MS[attempt] ?? 1_000;
          attempt += 1;
          await new Promise<void>((resolve) => {
            timer = setTimeout(() => {
              timer = null;
              resolve();
            }, delay);
          });
          if (cancelled) throw lastError;
          if (paused) throw lastError;
          return execute();
        }
      };
      return execute();
    },
    cancel() {
      cancelled = true;
      clearTimer();
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    getState() {
      return { lastError, attempt, paused };
    },
  };
}

/**
 * React hook that wires `createTraceRetry` to a fetcher + poll interval.
 * Auto-stops on unmount; exposes `paused` state and a `retry` action
 * that cancels the current backoff timer and fires immediately.
 */
export function useTraceRetry(fetcher: () => Promise<unknown>, options: { enabled: boolean; intervalMs?: number }) {
  const { enabled, intervalMs = 5_000 } = options;
  const [paused, setPaused] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  const controllerRef = useRef<TraceRetryController | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const createController = useCallback(() => {
    return createTraceRetry(async () => {
      const result = await fetcherRef.current();
      setLastError(null);
      return result;
    });
  }, []);

  useEffect(() => {
    if (!enabled || paused) return;
    const controller = createController();
    controllerRef.current = controller;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const schedulePoll = () => {
      pollTimer = setTimeout(async () => {
        try {
          await controller.run();
        } catch (err) {
          setLastError(err instanceof Error ? err : new Error(String(err)));
        }
        if (!paused) schedulePoll();
      }, intervalMs);
    };
    controller.run().catch((err) => {
      setLastError(err instanceof Error ? err : new Error(String(err)));
    });
    schedulePoll();
    return () => {
      controller.cancel();
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [enabled, paused, intervalMs, createController]);

  const retry = useCallback(() => {
    const controller = controllerRef.current;
    if (controller) controller.cancel();
    const fresh = createController();
    controllerRef.current = fresh;
    fresh.run().catch((err) => {
      setLastError(err instanceof Error ? err : new Error(String(err)));
    });
  }, [createController]);

  return { paused, lastError, setPaused, retry };
}
