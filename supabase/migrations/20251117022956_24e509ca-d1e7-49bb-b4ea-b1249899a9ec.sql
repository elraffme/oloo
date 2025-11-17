-- Phase 4: Database-backed signaling fallback table
CREATE TABLE IF NOT EXISTS public.webrtc_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL,
  session_token TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'broadcaster')),
  type TEXT NOT NULL CHECK (type IN ('viewer_joined', 'offer', 'answer', 'ice', 'request_offer', 'broadcaster_ready')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_stream_id ON public.webrtc_signals(stream_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_session_token ON public.webrtc_signals(session_token);
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_created_at ON public.webrtc_signals(created_at);
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_stream_type ON public.webrtc_signals(stream_id, type);

-- Enable RLS
ALTER TABLE public.webrtc_signals ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated and anon users to insert and select signaling messages for their streams
CREATE POLICY "Allow signaling for stream participants"
  ON public.webrtc_signals
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.webrtc_signals;

-- Cleanup function for old signals (>24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_webrtc_signals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.webrtc_signals
  WHERE created_at < NOW() - INTERVAL '24 hours';
  
  RAISE NOTICE 'Cleaned up old WebRTC signals';
END;
$$;

-- Note: To schedule this cleanup, run via cron extension or call periodically
-- Example: SELECT cron.schedule('cleanup-webrtc-signals', '0 * * * *', 'SELECT cleanup_old_webrtc_signals()');

COMMENT ON TABLE public.webrtc_signals IS 'Database-backed signaling fallback for WebRTC connections when realtime broadcast is unreliable';
COMMENT ON COLUMN public.webrtc_signals.stream_id IS 'The streaming session this signal belongs to';
COMMENT ON COLUMN public.webrtc_signals.session_token IS 'Unique viewer session token or broadcaster identifier';
COMMENT ON COLUMN public.webrtc_signals.role IS 'Whether this signal is from viewer or broadcaster';
COMMENT ON COLUMN public.webrtc_signals.type IS 'Type of WebRTC signaling message';
COMMENT ON COLUMN public.webrtc_signals.payload IS 'The actual signaling data (SDP, ICE candidates, etc)';
