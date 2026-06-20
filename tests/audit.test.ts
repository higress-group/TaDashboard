import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { recordAudit } from '@/lib/audit';

describe('recordAudit', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // recordAudit short-circuits when window is undefined; simulate a browser
    // environment so the spy below actually receives the call.
    vi.stubGlobal('window', {});
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('POSTs a serialized payload to /api/audit', async () => {
    await recordAudit({
      action: 'worker.delete',
      resource: 'worker',
      resourceId: 'alice',
      actor: 'admin@hiclaw.local',
      metadata: { runtime: 'openclaw', model: 'sonnet' },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe('/api/audit');
    const init = call[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'worker.delete',
      resource: 'worker',
      resourceId: 'alice',
      actor: 'admin@hiclaw.local',
      metadata: { runtime: 'openclaw', model: 'sonnet' },
    });
  });

  it('omits optional fields when not provided', async () => {
    await recordAudit({ action: 'team.create', resource: 'team' });

    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ action: 'team.create', resource: 'team' });
    expect(body.resourceId).toBeUndefined();
    expect(body.actor).toBeUndefined();
    expect(body.metadata).toBeUndefined();
  });

  it('swallows network errors without throwing', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('offline'));

    await expect(
      recordAudit({ action: 'manager.update', resource: 'manager', resourceId: 'm1' })
    ).resolves.toBeUndefined();
  });

  it('swallows non-2xx responses without throwing', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('boom', { status: 500 }));

    await expect(
      recordAudit({ action: 'human.delete', resource: 'human', resourceId: 'h1' })
    ).resolves.toBeUndefined();
  });

  it('records failure outcome with code and truncated error message', async () => {
    const longMsg = 'x'.repeat(500);
    await recordAudit({
      action: 'worker.delete',
      resource: 'worker',
      resourceId: 'alice',
      metadata: { outcome: 'failure', code: 'FORBIDDEN', error: longMsg.slice(0, 200) },
    });

    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.action).toBe('worker.delete');
    expect(body.resourceId).toBe('alice');
    expect(body.metadata.outcome).toBe('failure');
    expect(body.metadata.code).toBe('FORBIDDEN');
    expect((body.metadata.error as string).length).toBe(200);
  });
});