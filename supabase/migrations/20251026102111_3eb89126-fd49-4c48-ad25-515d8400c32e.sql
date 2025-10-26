-- Clean up zombie streams
UPDATE public.streaming_sessions 
SET status = 'ended', current_viewers = 0
WHERE status = 'live' AND started_at < NOW() - INTERVAL '2 hours';

-- Enable realtime updates for streaming_sessions
ALTER TABLE public.streaming_sessions REPLICA IDENTITY FULL;

-- Add stream_url column for debugging
ALTER TABLE public.streaming_sessions 
ADD COLUMN IF NOT EXISTS stream_url text;

-- Create function to auto-cleanup abandoned streams
CREATE OR REPLACE FUNCTION cleanup_abandoned_streams()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.streaming_sessions
  SET status = 'ended', current_viewers = 0
  WHERE status = 'live' 
    AND started_at < NOW() - INTERVAL '30 minutes'
    AND current_viewers = 0;
END;
$$;

-- Create trigger to broadcast streaming changes
CREATE OR REPLACE FUNCTION notify_streaming_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify(
    'streaming_change',
    json_build_object(
      'operation', TG_OP,
      'record', row_to_json(NEW)
    )::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS streaming_sessions_change ON public.streaming_sessions;
CREATE TRIGGER streaming_sessions_change
  AFTER INSERT OR UPDATE OR DELETE ON public.streaming_sessions
  FOR EACH ROW
  EXECUTE FUNCTION notify_streaming_change();