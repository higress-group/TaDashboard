'use client';

import { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { hiclawApi, type WorkerResponse } from '@/lib/hiclaw-api';

export type BulkAction = 'sleep' | 'wake' | 'ensure-ready' | 'delete';

export interface BulkFailure {
  worker: WorkerResponse;
  error: Error;
}

export interface BulkResult {
  successes: string[];
  failures: BulkFailure[];
}

export interface BulkOp {
  execute: (worker: WorkerResponse) => Promise<unknown>;
}

const ACTION_LABELS: Record<BulkAction, string> = {
  sleep: 'sleep',
  wake: 'wake',
  'ensure-ready': 'ensure-ready',
  delete: '删除',
};

function buildOp(action: BulkAction): BulkOp {
  switch (action) {
    case 'sleep':
      return { execute: (w) => hiclawApi.sleepWorker(w.name) };
    case 'wake':
      return { execute: (w) => hiclawApi.wakeWorker(w.name) };
    case 'ensure-ready':
      return { execute: (w) => hiclawApi.ensureReadyWorker(w.name) };
    case 'delete':
      return { execute: (w) => hiclawApi.deleteWorker(w.name) };
    default: {
      const exhaustive: never = action;
      throw new Error(`Unknown bulk action: ${exhaustive as string}`);
    }
  }
}

/**
 * Pure function: serially executes `op` over each worker, collecting
 * failures without aborting remaining work. Used by both the initial
 * run and the per-worker "retry" action.
 */
export async function runBulkAction(
  workers: WorkerResponse[],
  op: BulkOp,
): Promise<BulkResult> {
  const successes: string[] = [];
  const failures: BulkFailure[] = [];
  for (const worker of workers) {
    try {
      await op.execute(worker);
      successes.push(worker.name);
    } catch (err) {
      failures.push({ worker, error: err instanceof Error ? err : new Error(String(err)) });
    }
  }
  return { successes, failures };
}

export interface UseWorkerBulkActionOptions {
  onAfter?: () => void;
}

/**
 * Stateful controller around `runBulkAction`. Tracks in-flight progress
 * (total / completed), exposes a `retry(failure)` action for the per-row
 * "重试" button, and invalidates the workers query when finished.
 */
export function useWorkerBulkAction(options: UseWorkerBulkActionOptions = {}) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<BulkResult | null>(null);
  const cancelledRef = useRef(false);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['workers'] });
    options.onAfter?.();
  }, [queryClient, options]);

  const execute = useCallback(
    async (workers: WorkerResponse[], action: BulkAction) => {
      if (running) return;
      setRunning(true);
      setResult(null);
      cancelledRef.current = false;
      setProgress({ done: 0, total: workers.length });

      const op = buildOp(action);
      const successes: string[] = [];
      const failures: BulkFailure[] = [];
      for (let i = 0; i < workers.length; i += 1) {
        if (cancelledRef.current) break;
        const worker = workers[i];
        try {
          await op.execute(worker);
          successes.push(worker.name);
        } catch (err) {
          failures.push({ worker, error: err instanceof Error ? err : new Error(String(err)) });
        }
        setProgress({ done: i + 1, total: workers.length });
      }

      setResult({ successes, failures });
      setRunning(false);
      invalidate();
      return { successes, failures };
    },
    [running, invalidate],
  );

  const retry = useCallback(
    async (failure: BulkFailure) => {
      const op: BulkOp = { execute: () => hiclawApi.getWorker(failure.worker.name) };
      const r = await runBulkAction([failure.worker], op);
      const nextFailures = (result?.failures ?? []).filter((f) => f.worker.name !== failure.worker.name);
      const nextSuccesses = (result?.successes ?? []).filter((n) => n !== failure.worker.name);
      setResult({
        successes: r.successes.length ? [...nextSuccesses, ...r.successes] : nextSuccesses,
        failures: nextFailures,
      });
      invalidate();
    },
    [result, invalidate],
  );

  const skip = useCallback(
    (name: string) => {
      if (!result) return;
      setResult({
        successes: result.successes,
        failures: result.failures.filter((f) => f.worker.name !== name),
      });
    },
    [result],
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setProgress({ done: 0, total: 0 });
  }, []);

  return {
    execute,
    retry,
    skip,
    cancel,
    reset,
    running,
    progress,
    result,
    actionLabel: (action: BulkAction) => ACTION_LABELS[action],
  };
}
