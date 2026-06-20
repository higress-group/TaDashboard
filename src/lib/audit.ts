// Client-side audit helper. Posts dashboard actions to the
// server-side /api/audit endpoint which persists them via Prisma.

export type AuditAction =
  | "worker.create"
  | "worker.update"
  | "worker.delete"
  | "worker.wake"
  | "worker.sleep"
  | "worker.ensure-ready"
  | "team.create"
  | "team.update"
  | "team.delete"
  | "human.create"
  | "human.update"
  | "human.delete"
  | "manager.create"
  | "manager.update"
  | "manager.delete"
  | "consumer.create"
  | "consumer.delete";

export interface AuditPayload {
  action: AuditAction;
  resource: string;
  resourceId?: string;
  actor?: string;
  metadata?: Record<string, unknown>;
}

function getAuditToken(): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env.NEXT_PUBLIC_AUDIT_WRITE_TOKEN;
}

export async function recordAudit(payload: AuditPayload): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = getAuditToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    await fetch("/api/audit", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      // Audit writes are best-effort; do not block the caller on failures.
      keepalive: true,
    });
  } catch {
    // intentionally swallow
  }
}