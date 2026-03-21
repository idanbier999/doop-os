// Typed in-process EventEmitter for database change events.
// Repos emit after mutations; the SSE endpoint listens and pushes to clients.

type ChangeEvent = {
  table: string;
  event: "INSERT" | "UPDATE" | "DELETE";
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
  workspaceId: string;
};

type EventHandler = (event: ChangeEvent) => void;

class DbEventEmitter {
  private listeners = new Set<EventHandler>();

  on(handler: EventHandler) {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  emit(event: ChangeEvent) {
    for (const handler of this.listeners) {
      try {
        handler(event);
      } catch (e) {
        console.error("[events] Handler error:", e);
      }
    }
  }
}

export const dbEvents = new DbEventEmitter();
export type { ChangeEvent };
