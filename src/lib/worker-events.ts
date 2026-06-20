export interface WorkerEventsResponse {
  events?: Array<{ ts?: string; type?: string; level?: string; message?: string; [k: string]: unknown }>;
  items?: Array<{ ts?: string; type?: string; level?: string; message?: string; [k: string]: unknown }>;
}

export async function fetchWorkerEvents(name: string): Promise<WorkerEventsResponse | null> {
  const res = await fetch(`/api/hiclaw/workers/${encodeURIComponent(name)}/events`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Trace fetch failed: ${res.status}`);
  return (await res.json()) as WorkerEventsResponse;
}
