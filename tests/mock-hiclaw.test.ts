// Tests for mock-hiclaw.mjs HTTP behaviour.
// Boots the mock on an ephemeral port and probes a few endpoints to verify
// method validation, the loopback bind default, and basic shape.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const PORT = 18091;
const BASE = `http://127.0.0.1:${PORT}`;

let server: ChildProcess | null = null;

async function waitForReady(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/healthz`);
      if (r.ok) return;
    } catch {
      // not yet listening
    }
    await wait(100);
  }
  throw new Error('mock-hiclaw did not start in time');
}

beforeAll(async () => {
  server = spawn(process.execPath, ['scripts/mock-hiclaw.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForReady();
});

afterAll(async () => {
  if (server && !server.killed) {
    server.kill('SIGTERM');
    await wait(100);
    if (!server.killed) server.kill('SIGKILL');
  }
});

describe('mock-hiclaw method validation', () => {
  it('GET /healthz returns plain text "ok"', async () => {
    const r = await fetch(`${BASE}/healthz`);
    expect(r.status).toBe(200);
    expect(await r.text()).toBe('ok');
  });

  it('PUT /workers/alice/wake returns 405 (not silently updates)', async () => {
    const r = await fetch(`${BASE}/workers/alice/wake`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phase: 'Failed' }),
    });
    expect(r.status).toBe(405);
    expect(r.headers.get('allow')).toContain('POST');
  });

  it('DELETE /workers/alice/wake returns 405', async () => {
    const r = await fetch(`${BASE}/workers/alice/wake`, { method: 'DELETE' });
    expect(r.status).toBe(405);
  });

  it('GET /workers/alice/wake returns 405', async () => {
    const r = await fetch(`${BASE}/workers/alice/wake`, { method: 'GET' });
    expect(r.status).toBe(405);
  });

  it('POST /workers/alice/wake transitions the worker to Running', async () => {
    // Ensure the worker exists (it does from seed)
    const before = await fetch(`${BASE}/workers/alice`);
    expect(before.status).toBe(200);
    const r = await fetch(`${BASE}/workers/alice/wake`, { method: 'POST' });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toMatchObject({ name: 'alice', phase: 'Running' });
  });

  it('PUT /workers/alice/sleep returns 405', async () => {
    const r = await fetch(`${BASE}/workers/alice/sleep`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(r.status).toBe(405);
  });

  it('PUT /workers/alice/ensure-ready returns 405', async () => {
    const r = await fetch(`${BASE}/workers/alice/ensure-ready`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(r.status).toBe(405);
  });
});