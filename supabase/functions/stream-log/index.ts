import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Level = "debug" | "info" | "warn" | "error";

interface StreamEvent {
  session_id?: string | null;
  role?: string | null;
  phase?: string | null;
  event: string;
  level?: Level;
  message?: string | null;
  detail?: Record<string, unknown> | null;
  client_ts?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json();
    const events: StreamEvent[] = Array.isArray(body?.events)
      ? body.events
      : body?.event
      ? [body as StreamEvent]
      : [];

    if (events.length === 0) {
      return new Response(JSON.stringify({ error: "no events" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve the caller (optional — anonymous viewers may also report).
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const { data } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", ""),
      );
      userId = data?.user?.id ?? null;
    }

    const userAgent = req.headers.get("user-agent") ?? null;
    const rows = events.slice(0, 100).map((e) => ({
      session_id: e.session_id ?? null,
      user_id: userId,
      role: e.role ?? null,
      phase: e.phase ?? null,
      event: String(e.event).slice(0, 120),
      level: (e.level ?? "info") as Level,
      message: e.message ? String(e.message).slice(0, 2000) : null,
      detail: e.detail ?? {},
      user_agent: userAgent,
      client_ts: e.client_ts ?? new Date().toISOString(),
    }));

    // Structured server-side log lines — visible in edge function logs.
    for (const r of rows) {
      const line = `[stream-log][${r.level.toUpperCase()}] session=${
        r.session_id ?? "-"
      } user=${r.user_id ?? "-"} role=${r.role ?? "-"} phase=${
        r.phase ?? "-"
      } event=${r.event} msg=${r.message ?? "-"} detail=${
        JSON.stringify(r.detail)
      }`;
      if (r.level === "error") console.error(line);
      else if (r.level === "warn") console.warn(line);
      else console.log(line);
    }

    const { error } = await supabase.from("stream_diagnostics").insert(rows);
    if (error) {
      console.error("[stream-log] insert failed:", error.message, error.details);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, count: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stream-log] fatal:", (err as Error).message);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
