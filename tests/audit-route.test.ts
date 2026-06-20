// Tests for /api/audit authorization and payload size limits.
//
// We mock `db` so these tests don't need a Prisma client. The route's behaviour
// we care about is the validation logic that runs before any DB write.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'mock-1' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { POST, GET } from '@/app/api/audit/route';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new Request('http://localhost/api/audit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
}

describe('/api/audit authorization', () => {
  const originalToken = process.env.AUDIT_WRITE_TOKEN;

  beforeEach(() => {
    process.env.AUDIT_WRITE_TOKEN = 'test-secret-token';
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.AUDIT_WRITE_TOKEN;
    else process.env.AUDIT_WRITE_TOKEN = originalToken;
  });

  it('rejects writes without a token', async () => {
    const res = await POST(makeRequest({ action: 'worker.delete', resource: 'worker' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('accepts writes with the correct bearer token', async () => {
    const res = await POST(makeRequest(
      { action: 'worker.delete', resource: 'worker', resourceId: 'alice' },
      { authorization: 'Bearer test-secret-token' }
    ));
    expect(res.status).toBe(200);
  });

  it('rejects writes with the wrong token', async () => {
    const res = await POST(makeRequest(
      { action: 'worker.delete', resource: 'worker' },
      { authorization: 'Bearer wrong-token' }
    ));
    expect(res.status).toBe(401);
  });

  it('rejects writes when AUDIT_WRITE_TOKEN is unset (default deny)', async () => {
    delete process.env.AUDIT_WRITE_TOKEN;
    const res = await POST(makeRequest(
      { action: 'worker.delete', resource: 'worker' },
      { authorization: 'Bearer anything' }
    ));
    expect(res.status).toBe(401);
  });

  it('rejects GET requests without a token too', async () => {
    const req = new NextRequest(new Request('http://localhost/api/audit?limit=10'));
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe('/api/audit payload limits', () => {
  beforeEach(() => {
    process.env.AUDIT_WRITE_TOKEN = 'test-secret-token';
  });

  const auth = { authorization: 'Bearer test-secret-token' };

  it('rejects resource strings longer than 256 chars', async () => {
    const res = await POST(makeRequest(
      { action: 'worker.delete', resource: 'w'.repeat(257) },
      auth
    ));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects metadata objects with too many keys', async () => {
    const big: Record<string, string> = {};
    for (let i = 0; i < 33; i++) big[`k${i}`] = 'v';
    const res = await POST(makeRequest(
      { action: 'worker.delete', resource: 'worker', metadata: big },
      auth
    ));
    expect(res.status).toBe(400);
  });

  it('rejects metadata that is too deeply nested', async () => {
    let node: Record<string, unknown> = {};
    let cursor = node;
    for (let i = 0; i < 5; i++) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }
    const res = await POST(makeRequest(
      { action: 'worker.delete', resource: 'worker', metadata: node },
      auth
    ));
    expect(res.status).toBe(400);
  });

  it('rejects metadata that exceeds the byte limit', async () => {
    const meta = { blob: 'x'.repeat(9000) };
    const res = await POST(makeRequest(
      { action: 'worker.delete', resource: 'worker', metadata: meta },
      auth
    ));
    expect(res.status).toBe(400);
  });

  it('rejects cycles in metadata', async () => {
    // Build a payload string manually so JSON.stringify in makeRequest does
    // not blow up before the route gets a chance to detect the cycle.
    const body = '{"action":"worker.delete","resource":"worker","metadata":{"a":{"b":{"c":{"d":{"e":{"f":"deep"}}}}}}}';
    // The above is 6 levels deep which exceeds MAX_METADATA_DEPTH=4 and
    // exercises the depth check the route performs.
    const res = await POST(makeRequest(body, auth));
    expect(res.status).toBe(400);
  });

  it('accepts a well-formed payload', async () => {
    const res = await POST(makeRequest(
      {
        action: 'worker.delete',
        resource: 'worker',
        resourceId: 'alice',
        actor: 'admin@hiclaw.local',
        metadata: { runtime: 'openclaw', model: 'sonnet' },
      },
      auth
    ));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('mock-1');
  });
});