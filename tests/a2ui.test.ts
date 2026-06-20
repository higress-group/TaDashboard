/**
 * Interface contract tests for `src/lib/a2ui.ts`.
 *
 * Drives the public API of the A2UI v0.9 declarative renderer.
 */

import { describe, it, expect } from 'vitest';

describe('parseA2UIPayload', () => {
  it('parses a top-level a2ui document', async () => {
    const { parseA2UIPayload } = await import('@/lib/a2ui');
    const result = parseA2UIPayload({
      msgtype: 'app.a2ui',
      body: 'summary',
      a2ui: { root: 'card-1', components: [{ id: 'card-1', type: 'card', children: [] }] },
    });
    expect(result).not.toBeNull();
    expect(result?.doc.root).toBe('card-1');
    expect(result?.doc.components).toHaveLength(1);
    expect(result?.schemaRecognized).toBe(true);
  });

  it('flags unsupported schema versions as not recognized', async () => {
    const { parseA2UIPayload } = await import('@/lib/a2ui');
    const result = parseA2UIPayload({
      a2ui: { root: 'c-1', schemaVersion: '9.9', components: [{ id: 'c-1', type: 'card', children: [] }] },
    });
    expect(result?.schemaRecognized).toBe(false);
    expect(result?.doc.schemaVersion).toBe('9.9');
  });

  it('flags documents that contain unsupported component types', async () => {
    const { parseA2UIPayload } = await import('@/lib/a2ui');
    const result = parseA2UIPayload({
      a2ui: {
        root: 'c-1',
        components: [
          { id: 'c-1', type: 'card', children: ['x-1'] },
          { id: 'x-1', type: 'quantum-thing' },
        ],
      },
    });
    expect(result?.hasUnsupportedComponents).toBe(true);
  });

  it('returns null for non-a2ui messages', async () => {
    const { parseA2UIPayload } = await import('@/lib/a2ui');
    expect(parseA2UIPayload({ msgtype: 'm.text', body: 'hi' })).toBeNull();
  });

  it('returns null when components array is empty or missing', async () => {
    const { parseA2UIPayload } = await import('@/lib/a2ui');
    expect(parseA2UIPayload({ msgtype: 'app.a2ui', body: 'x', a2ui: { root: 'c-1' } })).toBeNull();
  });
});

describe('renderA2UI', () => {
  it('renders a known card with text child', async () => {
    const { renderA2UI } = await import('@/lib/a2ui');
    const tree = renderA2UI({
      root: 'c-1',
      components: [
        { id: 'c-1', type: 'card', children: ['t-1'] },
        { id: 't-1', type: 'text', text: 'hello' },
      ],
    });
    expect(tree.kind).toBe('card');
    expect(tree.children[0]).toMatchObject({ kind: 'text', text: 'hello' });
  });

  it('renders unknown components as a fallback badge', async () => {
    const { renderA2UI } = await import('@/lib/a2ui');
    const tree = renderA2UI({
      root: 'c-1',
      components: [
        { id: 'c-1', type: 'card', children: ['x-1'] },
        { id: 'x-1', type: 'quantum-thing' },
      ],
    });
    const child = tree.children[0] as { kind: string; componentType: string };
    expect(child.kind).toBe('unsupported');
    expect(child.componentType).toBe('quantum-thing');
  });

  it('drops action payloads that point to non-allow-listed hosts', async () => {
    const { renderA2UI } = await import('@/lib/a2ui');
    const tree = renderA2UI({
      root: 'c-1',
      components: [
        { id: 'c-1', type: 'card', children: ['b-1'] },
        { id: 'b-1', type: 'button', label: 'go', action: { kind: 'submit', endpoint: 'http://evil.example/steal' } },
      ],
    });
    const btn = tree.children[0] as { kind: string; action?: { endpoint: string } };
    expect(btn.kind).toBe('button');
    expect(btn.action).toBeUndefined();
  });

  it('keeps action payloads that point to allow-listed hosts', async () => {
    const { renderA2UI } = await import('@/lib/a2ui');
    const tree = renderA2UI({
      root: 'c-1',
      components: [
        { id: 'c-1', type: 'card', children: ['b-1'] },
        { id: 'b-1', type: 'button', label: 'wake', action: { kind: 'submit', endpoint: '/api/hiclaw/workers/alice/wake' } },
      ],
    });
    const btn = tree.children[0] as { kind: string; action?: { endpoint: string } };
    expect(btn.action?.endpoint).toBe('/api/hiclaw/workers/alice/wake');
  });
});