// Shared SSRF allow-list used by both proxy helpers and by client-side
// components (e.g. the A2UI renderer) that need to validate URLs
// before fetching them. Behavioural rules:
//
// 1. Relative paths starting with `/` are always allowed because they
//    resolve against the dashboard's own origin.
// 2. Absolute URLs must use http(s) and resolve to a host on the
//    combined allow-list (defaults + cluster suffixes + the
//    environment-driven `*_ALLOWED_HOSTS` extension).
// 3. Hosts on the `*.local` mDNS TLD are NOT in the default list;
//    operators can add them via the environment variable.

const DEFAULT_HOSTS = [
  'localhost',
  '127.0.0.1',
  '::1',
];

const CLUSTER_SUFFIXES = ['.svc', '.svc.cluster.local', '.cluster.local'];

export interface AllowList {
  isAllowed(url: string): boolean;
  defaultHosts(): readonly string[];
}

export function buildAllowList(envVarName: string, ...extraDefaults: string[]): AllowList {
  const defaults = [...DEFAULT_HOSTS, ...extraDefaults];
  function hosts(): string[] {
    if (typeof process === 'undefined') return defaults;
    const extra = process.env[envVarName];
    if (!extra) return defaults;
    return [...defaults, ...extra.split(',').map((h) => h.trim()).filter(Boolean)];
  }
  return {
    defaultHosts: () => Object.freeze(defaults),
    isAllowed(url: string): boolean {
      if (url.startsWith('/')) return true;
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return false;
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      const host = parsed.hostname;
      const list = hosts();
      return list.includes(host) || CLUSTER_SUFFIXES.some((s) => host.endsWith(s));
    },
  };
}

const matrixAllowList = buildAllowList('MATRIX_ALLOWED_HOSTS',
  'matrix', 'matrix.hiclaw-system', 'matrix.hiclaw-system.svc', 'matrix.hiclaw-system.svc.cluster.local',
);

const hiclawAllowList = buildAllowList('HICLAW_EXTRA_CONTROLLER_HOSTS',
  'hiclaw-controller', 'hiclaw-controller.hiclaw-system', 'hiclaw-controller.hiclaw-system.svc', 'hiclaw-controller.hiclaw-system.svc.cluster.local',
);

export function isAllowedMatrixUrl(url: string): boolean {
  return matrixAllowList.isAllowed(url);
}

export function isAllowedHiclawUrl(url: string): boolean {
  return hiclawAllowList.isAllowed(url);
}