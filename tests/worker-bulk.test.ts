import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runBulkAction, type BulkAction, type BulkOp } from '@/hooks/use-worker-bulk-action';

interface FakeWorker {
  name: string;
}

function makeOp(results: Array<'ok' | 'fail'>): BulkOp<FakeWorker> & { calls: string[] } {
  const op: BulkOp<FakeWorker> & { calls: string[] } = {
    calls: [],
    async execute(w) {
      op.calls.push(w.name);
      const r = results.shift() ?? 'ok';
      if (r === 'fail') throw new Error(`fail-${w.name}`);
      return { name: w.name };
    },
  };
  return op;
}

describe('runBulkAction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs serially through all workers', async () => {
    const op = makeOp(['ok', 'ok', 'ok']);
    const result = await runBulkAction([{ name: 'a' }, { name: 'b' }, { name: 'c' }], op);
    expect(result.successes).toEqual(['a', 'b', 'c']);
    expect(result.failures).toEqual([]);
    expect(op.calls).toEqual(['a', 'b', 'c']);
  });

  it('collects failures without stopping remaining work', async () => {
    const op = makeOp(['ok', 'fail', 'ok', 'fail']);
    const result = await runBulkAction([{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }], op);
    expect(result.successes).toEqual(['a', 'c']);
    expect(result.failures.map((f) => f.worker.name)).toEqual(['b', 'd']);
  });

  it('retry() re-runs a single failed worker', async () => {
    const op = makeOp(['fail', 'ok', 'ok']);
    const op2 = makeOp(['ok']);
    const first = await runBulkAction([{ name: 'a' }, { name: 'b' }, { name: 'c' }], op);
    expect(first.failures).toHaveLength(1);
    const retry = await runBulkAction([first.failures[0].worker], op2);
    expect(retry.successes).toEqual(['a']);
    expect(op2.calls).toEqual(['a']);
  });

  it('skip() removes the worker from the failure list', async () => {
    const op = makeOp(['fail', 'ok']);
    const first = await runBulkAction([{ name: 'a' }, { name: 'b' }], op);
    const remaining = first.failures.filter((f) => f.worker.name !== 'a');
    expect(remaining).toEqual([]);
  });

  it('all success returns no failures', async () => {
    const op = makeOp(['ok', 'ok']);
    const result = await runBulkAction([{ name: 'a' }, { name: 'b' }], op);
    expect(result.failures).toEqual([]);
  });

  it('returns immediately when worker list is empty', async () => {
    const op = makeOp([]);
    const result = await runBulkAction([], op);
    expect(result.successes).toEqual([]);
    expect(result.failures).toEqual([]);
    expect(op.calls).toEqual([]);
  });
});
