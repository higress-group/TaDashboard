/**
 * Unit tests for `src/lib/worker-export.ts`.
 *
 * The serializers are pure functions, so they run in the node
 * environment and don't need a DOM. Browsers are responsible for
 * triggering downloads / clipboard copies via `src/lib/download.ts`.
 */

import { describe, it, expect } from 'vitest';
import { workersToCsv, workersToJson } from '@/lib/worker-export';

describe('workersToCsv', () => {
  it('produces a header row even with empty input', () => {
    expect(workersToCsv([])).toBe('name,phase,state,runtime,model,image,team,role,matrixUserID,containerManaged,exposedPorts');
  });

  it('emits one row per worker with the right column order', () => {
    const csv = workersToCsv([
      {
        name: 'alice',
        phase: 'Running',
        state: 'Running',
        runtime: 'openclaw',
        model: 'claude-3-5',
        image: 'ghcr.io/org/alice:1',
        team: 'platform',
        role: 'coder',
        matrixUserID: '@alice:hs',
        containerManaged: true,
        exposedPorts: [{ port: 8080, domain: 'alice.example.com' }],
      },
    ]);
    const [header, row] = csv.split('\r\n');
    expect(header).toBe('name,phase,state,runtime,model,image,team,role,matrixUserID,containerManaged,exposedPorts');
    expect(row).toBe('alice,Running,Running,openclaw,claude-3-5,ghcr.io/org/alice:1,platform,coder,@alice:hs,true,8080:alice.example.com');
  });

  it('escapes commas, quotes and newlines per RFC 4180', () => {
    const csv = workersToCsv([
      {
        name: 'tricky,worker',
        phase: 'Running',
        state: 'Running',
        runtime: 'openclaw',
        model: 'has "quote"',
        image: 'multi\nline',
        team: 'team',
        role: 'r',
        matrixUserID: '@t:hs',
        containerManaged: false,
        exposedPorts: [],
      },
    ]);
    const [, row] = csv.split('\r\n');
    expect(row).toContain('"tricky,worker"');
    expect(row).toContain('"has ""quote"""');
    expect(row).toContain('"multi\nline"');
    expect(row.endsWith(',')).toBe(true);
  });

  it('joins multiple exposedPorts with pipe separator', () => {
    const csv = workersToCsv([
      {
        name: 'bob',
        phase: 'Ready',
        state: 'Running',
        runtime: 'openclaw',
        model: 'm',
        image: 'i',
        team: 't',
        role: 'r',
        matrixUserID: '@b:hs',
        containerManaged: false,
        exposedPorts: [
          { port: 8080, domain: 'a.example' },
          { port: 9090, domain: 'b.example' },
        ],
      },
    ]);
    expect(csv.split('\r\n')[1].endsWith('8080:a.example|9090:b.example')).toBe(true);
  });
});

describe('workersToJson', () => {
  it('produces pretty-printed JSON with the same shape', () => {
    const json = workersToJson([{ name: 'alice', phase: 'Running' }]);
    const parsed = JSON.parse(json) as Array<{ name: string; phase: string }>;
    expect(parsed).toEqual([{ name: 'alice', phase: 'Running' }]);
    expect(json).toContain('\n');
  });
});