import { supabase } from "@/integrations/supabase/client";

export type StreamLogLevel = "debug" | "info" | "warn" | "error";

export interface StreamLogEvent {
  session_id?: string | null;
  role?: string | null;
  phase?: string | null;
  event: string;
  level?: StreamLogLevel;
  message?: string | null;
  detail?: Record<string, unknown> | null;
  client_ts?: string;
}

const queue: StreamLogEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  flushTimer = null;
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    await supabase.functions.invoke("stream-log", { body: { events: batch } });
  } catch (err) {
    // Never let diagnostics break the stream flow.
    console.warn("[streamDiagnostics] failed to ship logs", err);
  }
}

/**
 * Emit a structured streaming diagnostic. Logged locally and shipped to the
 * `stream-log` edge function (server-side logs + stream_diagnostics table).
 */
export function logStreamEvent(event: StreamLogEvent) {
  const enriched: StreamLogEvent = {
    level: "info",
    ...event,
    client_ts: new Date().toISOString(),
    detail: {
      ...(event.detail ?? {}),
      url: typeof window !== "undefined" ? window.location.pathname : undefined,
    },
  };

  const prefix = `📊 [stream:${enriched.phase ?? "-"}] ${enriched.event}`;
  if (enriched.level === "error") console.error(prefix, enriched);
  else if (enriched.level === "warn") console.warn(prefix, enriched);
  else console.log(prefix, enriched.message ?? "", enriched.detail);

  queue.push(enriched);
  // Errors ship immediately; everything else is batched.
  if (enriched.level === "error") {
    if (flushTimer) clearTimeout(flushTimer);
    void flush();
    return;
  }
  if (!flushTimer) flushTimer = setTimeout(flush, 1500);
}

export function flushStreamLogs() {
  if (flushTimer) clearTimeout(flushTimer);
  return flush();
}
