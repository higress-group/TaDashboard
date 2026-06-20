import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jsonErrorBody, jsonErrorResponse, statusToCode } from '@/lib/api-errors';

const FEED_LIMIT = 20;
const PREVIEW_MAX = 60;

export const runtime = 'nodejs';

interface ActivityItem {
  id: string;
  kind: 'audit' | 'matrix' | 'infrastructure';
  ts: string;
  actor: string | null;
  action: string | null;
  resource: string | null;
  resourceId: string | null;
  preview: string | null;
  link: string | null;
}

function checkAuth(request: NextRequest): NextResponse | null {
  const required = process.env.AUDIT_WRITE_TOKEN;
  if (!required) return null;
  const auth = request.headers.get('authorization');
  if (auth && auth.replace(/^Bearer\s+/i, '') === required) return null;
  return NextResponse.json(
    jsonErrorBody(statusToCode(401), 'Unauthorized'),
    { status: 401 },
  );
}

function deriveLink(resource: string | null, resourceId: string | null): string | null {
  if (!resource) return null;
  if (resource === 'worker' || resource === 'team' || resource === 'human' || resource === 'manager' || resource === 'matrix') {
    return resource === 'matrix' ? '#chat' : `#${resource}s`;
  }
  if (resource === 'infrastructure') return '#infrastructure';
  return null;
}

function truncatePreview(s: string): string {
  if (s.length <= PREVIEW_MAX) return s;
  return `${s.slice(0, PREVIEW_MAX - 1)}…`;
}

function fromAuditLog(rows: { id: string; action: string; resource: string; resourceId: string | null; actor: string | null; metadata: string | null; createdAt: Date }[]): ActivityItem[] {
  return rows.map((r) => {
    let preview: string | null = null;
    if (r.metadata) {
      let parsed: unknown = null;
      if (typeof r.metadata === 'string') {
        try { parsed = JSON.parse(r.metadata); } catch { /* ignore */ }
      } else if (typeof r.metadata === 'object') {
        parsed = r.metadata;
      }
      if (parsed && typeof parsed === 'object') {
        const maybePreview = (parsed as { preview?: unknown }).preview;
        if (typeof maybePreview === 'string') preview = truncatePreview(maybePreview);
      }
    }
    return {
      id: r.id,
      kind: 'audit',
      ts: r.createdAt.toISOString(),
      actor: r.actor,
      action: r.action,
      resource: r.resource,
      resourceId: r.resourceId,
      preview,
      link: deriveLink(r.resource, r.resourceId),
    };
  });
}

export async function GET(request: NextRequest) {
  const denied = checkAuth(request);
  if (denied) return denied;

  try {
    const rows = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: FEED_LIMIT,
    });
    // Belt-and-suspenders cap: even if the backing store ignored `take`
    // (e.g. a test stub), the response never carries more than
    // FEED_LIMIT entries. R6-3.
    const items = fromAuditLog(rows).slice(0, FEED_LIMIT);
    return NextResponse.json({ items }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      jsonErrorBody('INTERNAL_ERROR', err instanceof Error ? err.message : 'Failed to read activity feed'),
      { status: 500 },
    );
  }
}