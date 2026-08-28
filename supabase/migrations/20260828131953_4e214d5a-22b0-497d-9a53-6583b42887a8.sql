CREATE TABLE IF NOT EXISTS public.stream_diagnostics (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_ts timestamptz,
  session_id uuid,
  user_id uuid,
  role text,
  phase text,
  event text not null,
  level text not null default 'info',
  message text,
  detail jsonb not null default '{}'::jsonb,
  user_agent text
);

CREATE INDEX IF NOT EXISTS stream_diagnostics_session_idx ON public.stream_diagnostics (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stream_diagnostics_created_idx ON public.stream_diagnostics (created_at DESC);

GRANT SELECT ON public.stream_diagnostics TO authenticated;
GRANT ALL ON public.stream_diagnostics TO service_role;

ALTER TABLE public.stream_diagnostics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own stream diagnostics" ON public.stream_diagnostics;
CREATE POLICY "Users can read their own stream diagnostics"
ON public.stream_diagnostics FOR SELECT TO authenticated
USING (user_id = auth.uid());