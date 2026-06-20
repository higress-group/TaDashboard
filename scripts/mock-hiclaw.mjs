#!/usr/bin/env node
// Mock HiClaw Controller for local dashboard development.
// Listens on PORT (default 8090) and answers the endpoints that the
// dashboard proxies via /api/hiclaw/*. State lives in memory only and is
// seeded with a small fixture set so the UI has something to render.
//
// Usage:
//   node scripts/mock-hiclaw.mjs               # 0.0.0.0:8090
//   PORT=8091 node scripts/mock-hiclaw.mjs     # custom port
//   MOCK_RESET=1 node scripts/mock-hiclaw.mjs  # wipe in-memory state on boot

import http from 'node:http';
import { URL } from 'node:url';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT || 8090);
// Default to loopback so the mock is not reachable from other hosts by accident.
// Set MOCK_HOST=0.0.0.0 explicitly to expose it on the LAN (useful for
// connecting a phone or another laptop during demos).
const HOST = process.env.MOCK_HOST || '127.0.0.1';
const RESET = process.env.MOCK_RESET === '1';

// -------- in-memory store --------

/** @type {Map<string, any>} */
const workers = new Map();
/** @type {Map<string, any>} */
const teams = new Map();
/** @type {Map<string, any>} */
const humans = new Map();
/** @type {Map<string, any>} */
const managers = new Map();
/** @type {Map<string, any>} */
const consumers = new Map();

function seed() {
  const now = new Date().toISOString();
  workers.set('alice', {
    name: 'alice',
    phase: 'Ready',
    state: 'Running',
    containerManaged: true,
    model: 'sonnet',
    runtime: 'openclaw',
    image: 'ghcr.io/hiclaw/openclaw:latest',
    containerState: 'running',
    matrixUserID: '@alice:hiclaw.local',
    roomID: '!workers:room:hiclaw.local',
    message: 'seeded',
    exposedPorts: [{ port: 8080, domain: 'alice.hiclaw.local' }],
    team: 'team-alpha',
    role: 'leader',
    skills: ['bash', 'web-fetch'],
    mcpServers: [{ name: 'minio', url: 'http://minio:9000', transport: 'http' }],
    version: '1.0.0',
  });
  workers.set('bob', {
    name: 'bob',
    phase: 'Pending',
    state: 'Stopped',
    containerManaged: false,
    model: 'haiku',
    runtime: 'copaw',
    image: 'ghcr.io/hiclaw/copaw:latest',
    containerState: 'absent',
    matrixUserID: '@bob:hiclaw.local',
    roomID: '!workers:room:hiclaw.local',
    message: 'awaiting first activation',
    team: 'team-alpha',
    role: 'worker',
    skills: [],
    mcpServers: [],
    version: '1.0.0',
  });
  teams.set('team-alpha', {
    name: 'team-alpha',
    teamName: 'Alpha Squad',
    phase: 'Active',
    description: 'seed team',
    admin: { name: 'admin-user' },
    humanMembers: ['demo'],
    leaderName: 'alice',
    leaderHeartbeat: { enabled: true, every: '30s' },
    workerIdleTimeout: '10m',
    teamRoomID: '!team-alpha:hiclaw.local',
    leaderDMRoomID: '!dm-alice:hiclaw.local',
    leaderReady: true,
    readyWorkers: 1,
    totalWorkers: 2,
    message: 'ok',
    workerNames: ['alice', 'bob'],
    workerExposedPorts: {
      alice: [{ port: 8080, domain: 'alice.hiclaw.local' }],
    },
  });
  humans.set('demo', {
    name: 'demo',
    phase: 'Active',
    displayName: 'Demo User',
    matrixUserID: '@demo:hiclaw.local',
    initialPassword: '(set on first login)',
    rooms: ['!team-alpha:hiclaw.local'],
    message: 'ok',
    permissionLevel: 1,
    accessibleTeams: ['team-alpha'],
    accessibleWorkers: ['alice', 'bob'],
    groupAllowFrom: [],
    email: 'demo@hiclaw.local',
    note: '',
  });
  managers.set('lead', {
    name: 'lead',
    phase: 'Running',
    state: 'Running',
    model: 'sonnet',
    runtime: 'openclaw',
    image: 'ghcr.io/hiclaw/manager:latest',
    matrixUserID: '@lead:hiclaw.local',
    roomID: '!manager:room:hiclaw.local',
    version: '1.0.0',
    message: 'ok',
    welcomeSent: true,
    skills: [],
  });
  consumers.set('gateway-1', {
    name: 'gateway-1',
    consumer_id: 'gateway-1',
    status: 'active',
  });
}

if (!RESET) seed();

// -------- helpers --------

function send(res, status, body, contentType = 'application/json') {
  const payload =
    body === null || body === undefined
      ? ''
      : contentType === 'application/json'
        ? JSON.stringify(body)
        : String(body);
  res.writeHead(status, {
    'content-type': contentType,
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  });
  res.end(payload);
}

function notFound(res, msg = 'not found') {
  send(res, 404, { error: { code: 'NOT_FOUND', message: msg } });
}

function badRequest(res, msg = 'bad request') {
  send(res, 400, { error: { code: 'BAD_REQUEST', message: msg } });
}

function methodNotAllowed(res, allowed, endpoint) {
  res.setHeader('Allow', allowed.join(', '));
  send(res, 405, {
    error: {
      code: 'BAD_REQUEST',
      message: `Method not allowed for ${endpoint}; allowed: ${allowed.join(', ')}`,
    },
  });
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function readMultipart(req) {
  // Minimal multipart parser just to extract the filename and forward a fake URI.
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const m = raw.match(/filename="([^"]+)"/);
      const name = m ? m[1] : `package-${randomUUID().slice(0, 8)}`;
      resolve({ packageUri: `pkg://local/${Date.now()}-${name}` });
    });
  });
}

// -------- router --------

const server = http.createServer(async (req, res) => {
  const raw = req.url || '/';
  const url = new URL(raw, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;
  const method = req.method || 'GET';

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    });
    return res.end();
  }

  // Health
  if (pathname === '/healthz' && method === 'GET') {
    return send(res, 200, 'ok', 'text/plain');
  }

  // Version
  if (pathname === '/version' && method === 'GET') {
    return send(res, 200, { controller: 'mock-1.0.0', kubeMode: true });
  }

  // Cluster status
  if (pathname === '/cluster-status' && method === 'GET') {
    return send(res, 200, {
      kubeMode: true,
      totalWorkers: workers.size,
      totalTeams: teams.size,
      totalHumans: humans.size,
    });
  }

  // Infrastructure
  if (pathname === '/infrastructure' && method === 'GET') {
    return send(res, 200, {
      minio: { healthy: true, endpoint: 'http://minio:9000', buckets: ['hiclaw-packages'] },
      higress: { healthy: true, endpoint: 'http://higress:8080' },
      matrix: { healthy: true, homeserver: 'https://matrix.hiclaw.local' },
      kubernetes: { healthy: true, version: 'v1.31.3+k3s1' },
      controller: { healthy: true, version: 'mock-1.0.0' },
    });
  }

  // Workers collection
  if (pathname === '/workers' && method === 'GET') {
    return send(res, 200, { workers: [...workers.values()], total: workers.size });
  }
  if (pathname === '/workers' && method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return badRequest(res, 'invalid JSON');
    }
    if (!body || typeof body.name !== 'string' || !body.name) {
      return badRequest(res, 'name is required');
    }
    const record = {
      name: body.name,
      phase: 'Pending',
      state: body.state || 'Stopped',
      containerManaged: body.containerManaged ?? true,
      model: body.model || 'sonnet',
      runtime: body.runtime || 'openclaw',
      image: body.image || `ghcr.io/hiclaw/${body.runtime || 'openclaw'}:latest`,
      containerState: 'absent',
      matrixUserID: `@${body.name}:hiclaw.local`,
      roomID: '!workers:room:hiclaw.local',
      message: 'created by mock',
      exposedPorts: [],
      team: body.team || '',
      role: body.role || 'worker',
      skills: body.skills || [],
      mcpServers: body.mcpServers || [],
      version: '1.0.0',
    };
    workers.set(record.name, record);
    return send(res, 201, record);
  }

  // Worker subroutes
  const workerMatch = pathname.match(/^\/workers\/([^/]+)(?:\/(wake|sleep|ensure-ready|status))?$/);
  if (workerMatch) {
    const [, name, action] = workerMatch;
    const worker = workers.get(name);
    if (action === 'status') {
      if (method !== 'GET') return methodNotAllowed(res, ['GET'], `worker/${name}/status`);
      if (!worker) return notFound(res, `worker ${name} not found`);
      return send(res, 200, worker);
    }
    if (action === 'wake' || action === 'sleep' || action === 'ensure-ready') {
      if (method !== 'POST') return methodNotAllowed(res, ['POST'], `worker/${name}/${action}`);
      if (!worker) return notFound(res, `worker ${name} not found`);
      if (action === 'wake') {
        worker.phase = 'Running';
        worker.state = 'Running';
        worker.containerState = 'running';
        worker.message = 'woken by mock';
      } else if (action === 'sleep') {
        worker.phase = 'Sleeping';
        worker.state = 'Sleeping';
        worker.containerState = 'stopped';
        worker.message = 'slept by mock';
      } else {
        worker.phase = 'Ready';
        worker.state = 'Running';
        worker.containerState = 'running';
        worker.message = 'ensured ready by mock';
      }
      return send(res, 200, { name, phase: worker.phase });
    }
    if (method === 'GET') {
      if (!worker) return notFound(res, `worker ${name} not found`);
      return send(res, 200, worker);
    }
    if (method === 'PUT') {
      if (!worker) return notFound(res, `worker ${name} not found`);
      let body;
      try {
        body = await readJsonBody(req);
      } catch {
        return badRequest(res, 'invalid JSON');
      }
      Object.assign(worker, body, { name });
      return send(res, 200, worker);
    }
    if (method === 'DELETE') {
      if (!worker) return notFound(res, `worker ${name} not found`);
      workers.delete(name);
      return send(res, 204, null);
    }
  }

  // Teams collection
  if (pathname === '/teams' && method === 'GET') {
    return send(res, 200, { teams: [...teams.values()] });
  }
  if (pathname === '/teams' && method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return badRequest(res, 'invalid JSON');
    }
    if (!body || typeof body.name !== 'string' || !body.name) {
      return badRequest(res, 'name is required');
    }
    const leader = body.leader || body.admin;
    const record = {
      name: body.name,
      teamName: body.teamName || body.name,
      phase: 'Pending',
      description: body.description || '',
      admin: leader ? { name: leader.name } : null,
      humanMembers: body.humanMembers || [],
      leaderName: leader ? leader.name : '',
      leaderHeartbeat: null,
      workerIdleTimeout: '10m',
      teamRoomID: `!${body.name}:hiclaw.local`,
      leaderDMRoomID: leader ? `!dm-${leader.name}:hiclaw.local` : '',
      leaderReady: false,
      readyWorkers: 0,
      totalWorkers: (body.workerNames || []).length,
      message: 'created by mock',
      workerNames: body.workerNames || [],
      workerExposedPorts: {},
    };
    teams.set(record.name, record);
    return send(res, 201, record);
  }

  const teamMatch = pathname.match(/^\/teams\/([^/]+)$/);
  if (teamMatch) {
    const [, name] = teamMatch;
    const team = teams.get(name);
    if (method === 'GET') {
      if (!team) return notFound(res, `team ${name} not found`);
      return send(res, 200, team);
    }
    if (method === 'PUT') {
      if (!team) return notFound(res, `team ${name} not found`);
      let body;
      try {
        body = await readJsonBody(req);
      } catch {
        return badRequest(res, 'invalid JSON');
      }
      if (body.leader !== undefined) {
        team.leaderName = body.leader?.name || '';
        team.admin = body.leader ? { name: body.leader.name } : null;
        delete body.leader;
      }
      Object.assign(team, body, { name });
      return send(res, 200, team);
    }
    if (method === 'DELETE') {
      if (!team) return notFound(res, `team ${name} not found`);
      teams.delete(name);
      return send(res, 204, null);
    }
  }

  // Humans collection
  if (pathname === '/humans' && method === 'GET') {
    return send(res, 200, { humans: [...humans.values()] });
  }
  if (pathname === '/humans' && method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return badRequest(res, 'invalid JSON');
    }
    if (!body || typeof body.name !== 'string' || !body.name) {
      return badRequest(res, 'name is required');
    }
    const record = {
      name: body.name,
      phase: 'Pending',
      displayName: body.displayName || body.name,
      matrixUserID: `@${body.name}:hiclaw.local`,
      initialPassword: `mock-${Math.random().toString(36).slice(2, 10)}`,
      rooms: [],
      message: 'created by mock',
      permissionLevel: body.permissionLevel || 1,
      accessibleTeams: body.accessibleTeams || [],
      accessibleWorkers: body.accessibleWorkers || [],
      groupAllowFrom: [],
      email: body.email || '',
      note: body.note || '',
    };
    humans.set(record.name, record);
    return send(res, 201, record);
  }

  const humanMatch = pathname.match(/^\/humans\/([^/]+)$/);
  if (humanMatch) {
    const [, name] = humanMatch;
    const human = humans.get(name);
    if (method === 'GET') {
      if (!human) return notFound(res, `human ${name} not found`);
      return send(res, 200, human);
    }
    if (method === 'PUT') {
      if (!human) return notFound(res, `human ${name} not found`);
      let body;
      try {
        body = await readJsonBody(req);
      } catch {
        return badRequest(res, 'invalid JSON');
      }
      Object.assign(human, body, { name });
      return send(res, 200, human);
    }
    if (method === 'DELETE') {
      if (!human) return notFound(res, `human ${name} not found`);
      humans.delete(name);
      return send(res, 204, null);
    }
  }

  // Managers collection
  if (pathname === '/managers' && method === 'GET') {
    return send(res, 200, { managers: [...managers.values()] });
  }
  if (pathname === '/managers' && method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return badRequest(res, 'invalid JSON');
    }
    if (!body || typeof body.name !== 'string' || !body.name) {
      return badRequest(res, 'name is required');
    }
    const record = {
      name: body.name,
      phase: 'Running',
      state: 'Running',
      model: body.model || 'sonnet',
      runtime: body.runtime || 'openclaw',
      image: body.image || `ghcr.io/hiclaw/manager:latest`,
      matrixUserID: `@${body.name}:hiclaw.local`,
      roomID: '!manager:room:hiclaw.local',
      version: '1.0.0',
      message: 'created by mock',
      welcomeSent: false,
      skills: [],
    };
    managers.set(record.name, record);
    return send(res, 201, record);
  }

  const managerMatch = pathname.match(/^\/managers\/([^/]+)$/);
  if (managerMatch) {
    const [, name] = managerMatch;
    const manager = managers.get(name);
    if (method === 'GET') {
      if (!manager) return notFound(res, `manager ${name} not found`);
      return send(res, 200, manager);
    }
    if (method === 'PUT') {
      if (!manager) return notFound(res, `manager ${name} not found`);
      let body;
      try {
        body = await readJsonBody(req);
      } catch {
        return badRequest(res, 'invalid JSON');
      }
      Object.assign(manager, body, { name });
      return send(res, 200, manager);
    }
    if (method === 'DELETE') {
      if (!manager) return notFound(res, `manager ${name} not found`);
      managers.delete(name);
      return send(res, 204, null);
    }
  }

  // Gateway consumers
  if (pathname === '/gateway/consumers' && method === 'GET') {
    return send(res, 200, { consumers: [...consumers.values()] });
  }
  if (pathname === '/gateway/consumers' && method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return badRequest(res, 'invalid JSON');
    }
    if (!body || typeof body.name !== 'string' || !body.name) {
      return badRequest(res, 'name is required');
    }
    const record = {
      name: body.name,
      consumer_id: body.name,
      status: 'pending',
    };
    consumers.set(record.consumer_id, record);
    return send(res, 201, record);
  }

  const consumerBindMatch = pathname.match(/^\/gateway\/consumers\/([^/]+)\/bind$/);
  if (consumerBindMatch && method === 'POST') {
    const [, id] = consumerBindMatch;
    const c = consumers.get(id);
    if (!c) return notFound(res, `consumer ${id} not found`);
    c.status = 'bound';
    return send(res, 204, null);
  }
  const consumerDeleteMatch = pathname.match(/^\/gateway\/consumers\/([^/]+)$/);
  if (consumerDeleteMatch && method === 'DELETE') {
    const [, id] = consumerDeleteMatch;
    if (!consumers.has(id)) return notFound(res, `consumer ${id} not found`);
    consumers.delete(id);
    return send(res, 204, null);
  }

  // Package upload
  if (pathname === '/packages' && method === 'POST') {
    const result = await readMultipart(req);
    return send(res, 201, result);
  }

  // Anything else
  send(res, 404, { error: { code: 'NOT_FOUND', message: `no mock handler for ${method} ${pathname}` } });
});

server.listen(PORT, HOST, () => {
  console.log(`[mock-hiclaw] listening on http://${HOST}:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\n[mock-hiclaw] shutting down');
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});