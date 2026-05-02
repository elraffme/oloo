-- Add host premium flag to streaming sessions
ALTER TABLE public.streaming_sessions
  ADD COLUMN IF NOT EXISTS host_is_premium boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_streaming_sessions_premium_status
  ON public.streaming_sessions (host_is_premium DESC, started_at DESC);

-- RPC to get a stream host's premium status (used by viewers to enforce viewer cap)
CREATE OR REPLACE FUNCTION public.get_stream_host_premium(p_stream_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT host_is_premium FROM public.streaming_sessions WHERE id = p_stream_id),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_stream_host_premium(uuid) TO anon, authenticated;

-- Stream replays table
CREATE TABLE IF NOT EXISTS public.stream_replays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL,
  stream_id uuid,
  title text NOT NULL DEFAULT 'Untitled replay',
  storage_path text NOT NULL,
  duration_sec integer NOT NULL DEFAULT 0,
  size_bytes bigint NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stream_replays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can view their own replays"
  ON public.stream_replays FOR SELECT
  USING (auth.uid() = host_user_id);

CREATE POLICY "Anyone authed can view public replays"
  ON public.stream_replays FOR SELECT
  USING (is_public = true AND auth.uid() IS NOT NULL);

CREATE POLICY "Hosts can insert their own replays"
  ON public.stream_replays FOR INSERT
  WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Hosts can update their own replays"
  ON public.stream_replays FOR UPDATE
  USING (auth.uid() = host_user_id);

CREATE POLICY "Hosts can delete their own replays"
  ON public.stream_replays FOR DELETE
  USING (auth.uid() = host_user_id);

CREATE INDEX IF NOT EXISTS idx_stream_replays_host
  ON public.stream_replays (host_user_id, created_at DESC);

-- Storage bucket for replays (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('stream-replays', 'stream-replays', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Hosts can upload own replays"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'stream-replays'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Hosts can read own replay files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'stream-replays'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Authed users can read public replay files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'stream-replays'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.stream_replays r
      WHERE r.storage_path = storage.objects.name
        AND r.is_public = true
    )
  );

CREATE POLICY "Hosts can delete own replay files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'stream-replays'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );