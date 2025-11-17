-- Update cleanup function to use 'archived' status instead of 'ended'
CREATE OR REPLACE FUNCTION cleanup_stale_live_streams()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Archive streams that have been "live" for more than 6 hours
  UPDATE public.streaming_sessions
  SET 
    status = 'archived',
    ended_at = NOW(),
    current_viewers = 0
  WHERE status = 'live'
    AND started_at < NOW() - INTERVAL '6 hours'
    AND ended_at IS NULL;
    
  RAISE NOTICE 'Archived % stale streams', 
    (SELECT COUNT(*) FROM public.streaming_sessions 
     WHERE status = 'archived' AND ended_at >= NOW() - INTERVAL '1 minute');
END;
$$;