/**
 * CSV / JSON serializers for the Workers surface.
 *
 * Kept as a pure module so it can be unit-tested without a browser.
 * The browser-side caller is responsible for triggering a download or
 * copying to the clipboard; the serializers only produce strings.
 */

export interface WorkerExportRow {
  name: string;
  phase: string;
  state: string;
  runtime: string;
  model: string;
  image: string;
  team: string;
  role: string;
  matrixUserID: string;
  containerManaged: string;
  exposedPorts: string;
}

const CSV_COLUMNS: (keyof WorkerExportRow)[] = [
  'name', 'phase', 'state', 'runtime', 'model', 'image', 'team', 'role', 'matrixUserID', 'containerManaged', 'exposedPorts',
];

/** RFC 4180 quoting: wrap in `"` when value contains `,` `"` `\n` `\r`; double inner `"`. */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function workersToCsv(workers: ReadonlyArray<unknown>): string {
  const header = CSV_COLUMNS.join(',');
  const rows = workers.map((raw) => {
    const w = raw as Record<string, unknown>;
    const exposed = Array.isArray(w.exposedPorts)
      ? (w.exposedPorts as Array<{ port?: number | string; domain?: string }>)
          .map((p) => `${p.port ?? ''}:${p.domain ?? ''}`)
          .join('|')
      : '';
    const row: WorkerExportRow = {
      name: String(w.name ?? ''),
      phase: String(w.phase ?? ''),
      state: String(w.state ?? ''),
      runtime: String(w.runtime ?? ''),
      model: String(w.model ?? ''),
      image: String(w.image ?? ''),
      team: String(w.team ?? ''),
      role: String(w.role ?? ''),
      matrixUserID: String(w.matrixUserID ?? ''),
      containerManaged: w.containerManaged === true ? 'true' : 'false',
      exposedPorts: exposed,
    };
    return CSV_COLUMNS.map((col) => csvEscape(row[col])).join(',');
  });
  return [header, ...rows].join('\r\n');
}

export function workersToJson(workers: ReadonlyArray<unknown>): string {
  return JSON.stringify(workers, null, 2);
}