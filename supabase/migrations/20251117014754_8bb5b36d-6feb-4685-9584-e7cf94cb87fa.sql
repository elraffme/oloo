-- Function to mark stale live streams as ended
CREATE OR REPLACE FUNCTION cleanup_stale_live_streams()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  -- Mark streams as ended if they've been "live" for more than 6 hours
  UPDATE public.streaming_sessions
  SET 
    status = 'ended',
    ended_at = NOW(),
    current_viewers = 0
  WHERE status = 'live'
    AND started_at < NOW() - INTERVAL '6 hours'
    AND ended_at IS NULL;
    
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % stale streams', cleaned_count;
END;
$$;

-- Schedule to run every hour
SELECT cron.schedule(
  'cleanup-stale-streams',
  '0 * * * *',
  $$SELECT cleanup_stale_live_streams();$$
);