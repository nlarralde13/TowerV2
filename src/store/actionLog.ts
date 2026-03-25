import type { ActionLogEntry, ActionLogEntryInput } from "./types";

export const MAX_ACTION_LOG_ENTRIES = 200;

let actionLogCounter = 0;

export function nextActionLogId(): string {
  actionLogCounter += 1;
  return `log_${Date.now()}_${actionLogCounter}`;
}

export function withActionLogs(existing: ActionLogEntry[], messages: ActionLogEntryInput[]): ActionLogEntry[] {
  if (messages.length === 0) {
    return existing;
  }
  const now = Date.now();
  const next = [
    ...existing,
    ...messages.map((entry, index) => ({
      id: nextActionLogId(),
      timestamp: now + index,
      category: entry.category,
      level: entry.level ?? ("info" as const),
      eventType: entry.eventType ?? "message",
      message: entry.message,
      payload: entry.payload,
    })),
  ];
  return next.slice(Math.max(0, next.length - MAX_ACTION_LOG_ENTRIES));
}
