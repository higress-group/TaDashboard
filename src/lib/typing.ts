// Typing indicator helpers for Matrix `m.typing` ephemeral events.
//
// The publisher throttles PUT requests to the Matrix homeserver so the
// dashboard never floods the room with typing notifications while a
// user is composing. The observer keeps a small in-memory map of
// "currently typing" senders keyed by last-seen timestamp so the UI
// can prune stale entries without a server round-trip.

export interface TypingPublisherOptions {
  roomId: string;
  intervalMs?: number;
  fetchImpl?: typeof fetch;
}

export interface TypingPublisher {
  notify: () => void;
  stop: () => void;
  dispose: () => void;
}

/**
 * Build a typed publisher that posts `PUT /api/matrix/rooms/{id}/typing`
 * at most once per `intervalMs` while the caller keeps calling
 * `notify()`. `stop()` clears the pending publish; `dispose()` also
 * releases the timer.
 */
export function createTypingPublisher({
  roomId,
  intervalMs = 4000,
  fetchImpl,
}: TypingPublisherOptions): TypingPublisher {
  const doFetch = fetchImpl ?? fetch;
  let lastPublishAt = 0;
  let started = true;
  let pending: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const flush = () => {
    if (disposed || !started) return;
    lastPublishAt = Date.now();
    const url = `/api/matrix/rooms/${encodeURIComponent(roomId)}/typing`;
    void doFetch(url, {
      method: 'PUT',
      keepalive: true,
    }).catch(() => {
      // R1-4: network failures are swallowed silently.
    });
  };

  return {
    notify() {
      if (disposed || !started) return;
      const now = Date.now();
      const elapsed = now - lastPublishAt;
      if (elapsed >= intervalMs) {
        if (pending) {
          clearTimeout(pending);
          pending = null;
        }
        flush();
        return;
      }
      if (pending) return;
      const wait = intervalMs - elapsed;
      pending = setTimeout(() => {
        pending = null;
        flush();
      }, wait);
    },
    stop() {
      started = false;
      if (pending) {
        clearTimeout(pending);
        pending = null;
      }
    },
    dispose() {
      disposed = true;
      started = false;
      if (pending) {
        clearTimeout(pending);
        pending = null;
      }
    },
  };
}

/**
 * Drop senders whose last seen `m.typing` timestamp is older than
 * `maxAgeMs`. Used by the observer to keep the typing row current
 * without a server round-trip.
 */
export function pruneStaleTypers(
  typers: Map<string, number>,
  maxAgeMs = 6000,
  now: number = Date.now(),
): Map<string, number> {
  const next = new Map<string, number>();
  for (const [sender, ts] of typers) {
    if (now - ts <= maxAgeMs) next.set(sender, ts);
  }
  return next;
}

/**
 * Pure helper for tests and the observer: given a list of typing
 * events with timestamps, return the senders that should currently
 * show as typing.
 */
export function collectActiveTypers(
  events: { sender: string; ts: number }[],
  maxAgeMs = 6000,
  now: number = Date.now(),
): string[] {
  const seen = new Map<string, number>();
  for (const e of events) {
    const prev = seen.get(e.sender);
    if (prev === undefined || e.ts > prev) seen.set(e.sender, e.ts);
  }
  return Array.from(pruneStaleTypers(seen, maxAgeMs, now).keys());
}