-- Clean up existing stale 'live' streams (older than 30 minutes with no activity)
UPDATE public.streaming_sessions
SET 
  status = 'ended',
  ended_at = COALESCE(started_at + INTERVAL '30 minutes', created_at + INTERVAL '30 minutes', NOW()),
  current_viewers = 0
WHERE status = 'live' 
  AND (
    (started_at IS NOT NULL AND started_at < NOW() - INTERVAL '30 minutes')
    OR (started_at IS NULL AND created_at < NOW() - INTERVAL '30 minutes')
  );

-- Create function to automatically cleanup stale streams
CREATE OR REPLACE FUNCTION public.cleanup_stale_streams()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.streaming_sessions
  SET 
    status = 'ended',
    ended_at = COALESCE(started_at + INTERVAL '4 hours', created_at + INTERVAL '4 hours', NOW()),
    current_viewers = 0
  WHERE status = 'live' 
    AND (
      (started_at IS NOT NULL AND started_at < NOW() - INTERVAL '4 hours')
      OR (started_at IS NULL AND created_at < NOW() - INTERVAL '4 hours')
    );
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION public.cleanup_stale_streams() IS 'Automatically marks streams as ended if they have been live for more than 4 hours without proper closure';