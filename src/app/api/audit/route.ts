import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jsonErrorBody, jsonErrorResponse, statusToCode } from '@/lib/api-errors';

const ALLOWED_ACTIONS = new Set([
  'worker.create',
  'worker.update',
  'worker.delete',
  'worker.wake',
  'worker.sleep',
  'worker.ensure-ready',
  'team.create',
  'team.update',
  'team.delete',
  'human.create',
  'human.update',
  'human.delete',
  'manager.create',
  'manager.update',
  'manager.delete',
  'consumer.create',
  'consumer.delete',
]);

const MAX_STRING = 256;
const MAX_METADATA_KEYS = 32;
const MAX_METADATA_DEPTH = 4;
const MAX_METADATA_BYTES = 8192;

function sanitizeString(value: unknown, field: string, max = MAX_STRING): string | null {
  if (typeof value !== 'string') return null;
  if (value.length === 0 || value.length > max) {
    throw new Error(`Field "${field}" must be a non-empty string up to ${max} chars`);
  }
  return value;
}

function sanitizeMetadata(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    if (value.length > MAX_METADATA_BYTES) {
      throw new Error(`metadata string exceeds ${MAX_METADATA_BYTES} bytes`);
    }
    return value;
  }
  if (typeof value !== 'object') {
    throw new Error('metadata must be an object or string');
  }
  const seen = new WeakSet();
  function walk(node: unknown, depth: number): unknown {
    if (depth > MAX_METADATA_DEPTH) {
      throw new Error(`metadata exceeds ${MAX_METADATA_DEPTH} levels of nesting`);
    }
    if (node === null) return null;
    if (typeof node === 'string') return node;
    if (typeof node === 'number' || typeof node === 'boolean') return node;
    if (Array.isArray(node)) return node.map((v) => walk(v, depth + 1));
    if (typeof node === 'object') {
      if (seen.has(node as object)) throw new Error('metadata contains a cycle');
      seen.add(node as object);
      const entries = Object.entries(node as Record<string, unknown>);
      if (entries.length > MAX_METADATA_KEYS) {
        throw new Error(`metadata exceeds ${MAX_METADATA_KEYS} keys`);
      }
      const out: Record<string, unknown> = {};
      for (const [k, v] of entries) {
        if (typeof k !== 'string' || k.length === 0 || k.length > MAX_STRING) {
          throw new Error(`metadata key "${k}" is invalid`);
        }
        out[k] = walk(v, depth + 1);
      }
      return out;
    }
    return undefined;
  }
  const cleaned = walk(value, 0);
  const serialized = JSON.stringify(cleaned);
  if (serialized.length > MAX_METADATA_BYTES) {
    throw new Error(`metadata exceeds ${MAX_METADATA_BYTES} bytes after serialization`);
  }
  return serialized;
}

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.AUDIT_WRITE_TOKEN;
  if (!expected) {
    // No shared secret configured: refuse writes by default.
    // Set AUDIT_WRITE_TOKEN to allow server-to-server writes.
    return false;
  }
  const incoming =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.headers.get('x-audit-token') ||
    '';
  return incoming === expected;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return jsonErrorResponse('UNAUTHORIZED', 'Audit write requires AUDIT_WRITE_TOKEN', {
      status: 401,
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      jsonErrorBody('BAD_REQUEST', 'Audit log payload must be valid JSON'),
      { status: 400 },
    );
  }

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json(
      jsonErrorBody('BAD_REQUEST', 'Audit log payload must be an object'),
      { status: 400 },
    );
  }

  const body = payload as {
    action?: unknown;
    resource?: unknown;
    resourceId?: unknown;
    actor?: unknown;
    metadata?: unknown;
  };

  if (typeof body.action !== 'string' || !ALLOWED_ACTIONS.has(body.action)) {
    return NextResponse.json(
      jsonErrorBody('BAD_REQUEST', `Unsupported audit action: ${String(body.action)}`),
      { status: 400 },
    );
  }

  let resource: string;
  let resourceId: string | null;
  let actor: string | null;
  let metadata: string | null;
  try {
    resource = sanitizeString(body.resource, 'resource') as string;
    resourceId = sanitizeString(body.resourceId, 'resourceId');
    actor = sanitizeString(body.actor, 'actor');
    metadata = sanitizeMetadata(body.metadata);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid audit payload';
    return NextResponse.json(
      jsonErrorBody('BAD_REQUEST', message),
      { status: 400 },
    );
  }

  try {
    const entry = await db.auditLog.create({
      data: {
        action: body.action,
        resource,
        resourceId,
        actor,
        metadata,
      },
    });
    return NextResponse.json({ id: entry.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to write audit log';
    return NextResponse.json(
      jsonErrorBody(statusToCode(500), message),
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return jsonErrorResponse('UNAUTHORIZED', 'Audit read requires AUDIT_WRITE_TOKEN', {
      status: 401,
    });
  }
  const limitParam = request.nextUrl.searchParams.get('limit');
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 50;
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;
  const resource = request.nextUrl.searchParams.get('resource');

  try {
    const entries = await db.auditLog.findMany({
      where: resource ? { resource } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return NextResponse.json({ entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read audit log';
    return NextResponse.json(
      jsonErrorBody(statusToCode(500), message),
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';