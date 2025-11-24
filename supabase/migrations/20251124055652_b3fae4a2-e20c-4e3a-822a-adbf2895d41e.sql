-- Add viewer camera status tracking to stream_viewer_sessions
ALTER TABLE stream_viewer_sessions 
ADD COLUMN IF NOT EXISTS camera_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS camera_stream_active BOOLEAN DEFAULT false;

-- Create table for viewer-to-host WebRTC signaling
CREATE TABLE IF NOT EXISTS viewer_webrtc_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streaming_sessions(id) ON DELETE CASCADE,
  viewer_session_token TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice')),
  signal_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient signal lookups
CREATE INDEX IF NOT EXISTS idx_viewer_webrtc_signals_stream_session 
ON viewer_webrtc_signals(stream_id, viewer_session_token);

-- Create index for cleanup
CREATE INDEX IF NOT EXISTS idx_viewer_webrtc_signals_created_at 
ON viewer_webrtc_signals(created_at);

-- Enable RLS
ALTER TABLE viewer_webrtc_signals ENABLE ROW LEVEL SECURITY;

-- Allow viewers to insert their own signals (both authenticated and anonymous viewers)
CREATE POLICY "Viewers can send camera signals"
ON viewer_webrtc_signals FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Allow host to read signals for their stream
CREATE POLICY "Host can read viewer camera signals"
ON viewer_webrtc_signals FOR SELECT
TO authenticated, anon
USING (
  stream_id IN (
    SELECT id FROM streaming_sessions 
    WHERE host_user_id = auth.uid()
  ) OR auth.uid() IS NULL
);

-- Allow deletion of old signals (cleanup)
CREATE POLICY "Allow cleanup of old signals"
ON viewer_webrtc_signals FOR DELETE
TO authenticated, anon
USING (created_at < NOW() - INTERVAL '1 hour');

-- Function to cleanup old viewer WebRTC signals
CREATE OR REPLACE FUNCTION cleanup_old_viewer_webrtc_signals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM viewer_webrtc_signals
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Add viewer_webrtc_signals to realtime publication for real-time signaling
ALTER PUBLICATION supabase_realtime ADD TABLE viewer_webrtc_signals;