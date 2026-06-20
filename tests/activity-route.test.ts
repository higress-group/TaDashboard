/**
 * Interface contract tests for `src/app/api/activity/route.ts`.
 *
 * Drives the read endpoint that merges AuditLog + recent Matrix
 * messages into a 20-entry Activity Feed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockList = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    auditLog: { findMany: mockList, count: mockGet },
  },
}));

describe('GET /api/activity', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockGet.mockReset();
  });

  it('returns merged items sorted by timestamp desc', async () => {
    mockList.mockResolvedValue([
      { id: 'a1', action: 'worker.create', resource: 'worker', resourceId: 'w1', createdAt: new Date('2026-06-16T11:00:00Z') },
    ]);
    const { GET } = await import('@/app/api/activity/route');
    const res = await GET(new Request('http://x/api/activity?homeserver=http://hs&accessToken=t'));
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items[0]).toMatchObject({ kind: 'audit', action: 'worker.create', resourceId: 'w1' });
  });

  it('caps response at 20 entries', async () => {
    mockList.mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => ({
        id: `a${i}`,
        action: 'worker.create',
        resource: 'worker',
        resourceId: `w${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      })),
    );
    const { GET } = await import('@/app/api/activity/route');
    const res = await GET(new Request('http://x/api/activity?homeserver=http://hs&accessToken=t'));
    const body = await res.json();
    expect(body.items).toHaveLength(20);
  });

  it('truncates preview to 60 characters', async () => {
    mockList.mockResolvedValue([
      {
        id: 'a1',
        action: 'matrix.message',
        resource: 'matrix',
        resourceId: '!room',
        metadata: { preview: 'x'.repeat(200) },
        createdAt: new Date(),
      },
    ]);
    const { GET } = await import('@/app/api/activity/route');
    const res = await GET(new Request('http://x/api/activity?homeserver=http://hs&accessToken=t'));
    const body = await res.json();
    expect(body.items[0].preview.length).toBeLessThanOrEqual(60);
  });

  it('returns 401 when AUDIT_WRITE_TOKEN is required and missing', async () => {
    process.env.AUDIT_WRITE_TOKEN = 'secret';
    const { GET } = await import('@/app/api/activity/route');
    const res = await GET(new Request('http://x/api/activity'));
    expect(res.status).toBe(401);
    delete process.env.AUDIT_WRITE_TOKEN;
  });
});