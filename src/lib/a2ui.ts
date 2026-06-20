// A2UI v0.9 declarative renderer. Consumes a JSON payload emitted by
// an Agent and produces a render tree that the chat UI can map onto
// shadcn / Radix primitives. Components outside the supported set
// degrade to a fallback "unsupported" node so the chat bubble stays
// readable.
//
// Security: action endpoints are filtered through the same allow-list
// the proxy helpers use, so a hostile payload cannot reach an
// arbitrary URL.

import { isAllowedMatrixUrl, isAllowedHiclawUrl } from '@/lib/url-allow-list';

export type A2UINode =
  | { kind: 'card'; children: A2UINode[] }
  | { kind: 'row'; children: A2UINode[] }
  | { kind: 'column'; children: A2UINode[] }
  | { kind: 'text'; text: string }
  | { kind: 'image'; url: string; alt?: string }
  | { kind: 'button'; label: string; action?: A2UIAction }
  | { kind: 'text-input'; name: string; label?: string; placeholder?: string; value?: string }
  | { kind: 'form'; children: A2UINode[]; submit?: A2UIAction }
  | { kind: 'unsupported'; componentType: string };

export interface A2UIAction {
  kind: 'submit';
  endpoint: string;
  body?: Record<string, unknown>;
}

export interface A2UIComponent {
  id: string;
  type: string;
  text?: string;
  label?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  url?: string;
  alt?: string;
  children?: string[];
  action?: { kind?: string; endpoint?: string; body?: Record<string, unknown> };
}

export interface A2UIDocument {
  root: string;
  components: A2UIComponent[];
  /** Optional A2UI protocol version tag (e.g. `"0.9"`). Forwarded
   *  unchanged so the renderer can decide whether the document is
   *  compatible with the locally supported type set. */
  schemaVersion?: string;
}

export interface A2UIParseResult {
  doc: A2UIDocument;
  /** True when the document's `schemaVersion` is one we explicitly
   *  recognise. Unknown versions are still rendered; the chat UI may
   *  surface a soft warning. */
  schemaRecognized: boolean;
  /** True when at least one component type is not in `SUPPORTED_TYPES`. */
  hasUnsupportedComponents: boolean;
}

/** Protocol versions this build of the renderer was designed for. */
const KNOWN_SCHEMA_VERSIONS = new Set(['0.9']);

const SUPPORTED_TYPES = new Set([
  'card',
  'row',
  'column',
  'text',
  'image',
  'button',
  'text-input',
  'form',
]);

/**
 * Pull the A2UI payload from a Matrix message body. The Agent emits
 * a `body.a2ui` envelope; we also accept a top-level `a2ui` field
 * for direct callers (e.g. tests).
 *
 * Returns a structured result so callers can show a soft warning
 * when the Agent emits a future schema version we don't explicitly
 * recognise. The chat UI still renders the document either way —
 * drift detection is informational, not blocking.
 */
export function parseA2UIPayload(
  body: Record<string, unknown> | null | undefined,
): A2UIParseResult | null {
  if (!body || typeof body !== 'object') return null;
  const candidate =
    (body.a2ui as unknown) ?? (body.content as { a2ui?: unknown })?.a2ui ?? null;
  if (!candidate || typeof candidate !== 'object') return null;
  const doc = candidate as A2UIDocument;
  if (typeof doc.root !== 'string') return null;
  if (!Array.isArray(doc.components) || doc.components.length === 0) return null;
  const schemaVersion = typeof doc.schemaVersion === 'string' ? doc.schemaVersion : undefined;
  const schemaRecognized = schemaVersion ? KNOWN_SCHEMA_VERSIONS.has(schemaVersion) : true;
  const hasUnsupportedComponents = doc.components.some((c) => !SUPPORTED_TYPES.has(c.type));
  return { doc, schemaRecognized, hasUnsupportedComponents };
}

function isAllowedEndpoint(endpoint: string): boolean {
  // Same-origin relative paths are always allowed; they go through
  // the dashboard's own proxy. Absolute URLs must point to a host on
  // the matrix OR hiclaw allow-list; the proxy will re-validate them
  // on the way out.
  if (endpoint.startsWith('/')) return true;
  if (endpoint.includes('://') && !endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    return false;
  }
  return isAllowedMatrixUrl(endpoint) || isAllowedHiclawUrl(endpoint);
}

function renderComponent(
  component: A2UIComponent,
  byId: Map<string, A2UIComponent>,
): A2UINode {
  if (!SUPPORTED_TYPES.has(component.type)) {
    return { kind: 'unsupported', componentType: component.type };
  }
  switch (component.type) {
    case 'card':
    case 'row':
    case 'column':
      return { kind: component.type, children: renderChildren(component, byId) };
    case 'form':
      return {
        kind: 'form',
        children: renderChildren(component, byId),
        submit: renderAction(component.action),
      };
    case 'text':
      return { kind: 'text', text: component.text ?? '' };
    case 'image':
      return { kind: 'image', url: component.url ?? '', alt: component.alt };
    case 'button':
      return { kind: 'button', label: component.label ?? '', action: renderAction(component.action) };
    case 'text-input':
      return {
        kind: 'text-input',
        name: component.name ?? component.id,
        label: component.label,
        placeholder: component.placeholder,
        value: component.value,
      };
    default:
      return { kind: 'unsupported', componentType: component.type };
  }
}

function renderChildren(
  component: A2UIComponent,
  byId: Map<string, A2UIComponent>,
): A2UINode[] {
  const out: A2UINode[] = [];
  for (const childId of component.children ?? []) {
    const child = byId.get(childId);
    if (!child) continue;
    out.push(renderComponent(child, byId));
  }
  return out;
}

function renderAction(
  action: A2UIComponent['action'],
): A2UIAction | undefined {
  if (!action) return undefined;
  if (action.kind !== 'submit' || !action.endpoint) return undefined;
  if (!isAllowedEndpoint(action.endpoint)) return undefined;
  return { kind: 'submit', endpoint: action.endpoint, body: action.body };
}

/**
 * Map an A2UI document to a tree of render nodes. The chat UI is
 * responsible for converting the node tree into React components.
 */
export function renderA2UI(doc: A2UIDocument): A2UINode {
  const byId = new Map<string, A2UIComponent>();
  for (const c of doc.components) byId.set(c.id, c);
  const root = byId.get(doc.root);
  if (!root) return { kind: 'unsupported', componentType: 'missing-root' };
  return renderComponent(root, byId);
}