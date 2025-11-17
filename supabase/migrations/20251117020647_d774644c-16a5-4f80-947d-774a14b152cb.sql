-- First, update the check constraint to allow 'archived' status
ALTER TABLE public.streaming_sessions
DROP CONSTRAINT IF EXISTS streaming_sessions_status_check;

ALTER TABLE public.streaming_sessions
ADD CONSTRAINT streaming_sessions_status_check 
CHECK (status IN ('waiting', 'live', 'ended', 'archived'));

-- Phase 1: Fix the cleanup function to handle all edge cases
CREATE OR REPLACE FUNCTION cleanup_stale_live_streams()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Archive streams in any of these conditions:
  -- 1. Started > 6 hours ago
  -- 2. Created > 6 hours ago but never started (started_at IS NULL)
  -- 3. Created > 1 hour ago with no viewers and never started
  UPDATE public.streaming_sessions
  SET 
    status = 'archived',
    ended_at = NOW(),
    current_viewers = 0
  WHERE status = 'live'
    AND ended_at IS NULL
    AND (
      -- Condition 1: Started and running for 6+ hours
      (started_at IS NOT NULL AND started_at < NOW() - INTERVAL '6 hours')
      OR
      -- Condition 2: Never started but created 6+ hours ago
      (started_at IS NULL AND created_at < NOW() - INTERVAL '6 hours')
      OR
      -- Condition 3: Never started, no viewers, and created 1+ hours ago
      (started_at IS NULL AND current_viewers = 0 AND created_at < NOW() - INTERVAL '1 hour')
    );
    
  RAISE NOTICE 'Archived % stale streams', 
    (SELECT COUNT(*) FROM public.streaming_sessions 
     WHERE status = 'archived' AND ended_at >= NOW() - INTERVAL '1 minute');
END;
$$;

-- Phase 2: Migrate all existing 'ended' streams to 'archived' status
UPDATE public.streaming_sessions
SET status = 'archived'
WHERE status = 'ended';

-- Phase 3: Add validation trigger to prevent stuck streams
CREATE OR REPLACE FUNCTION validate_streaming_session_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is being set to 'live', ensure started_at is set OR it's a new record
  IF NEW.status = 'live' AND NEW.started_at IS NULL AND OLD.created_at IS NOT NULL THEN
    -- Allow it but log a warning
    RAISE WARNING 'Stream % is live but has no started_at time', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS validate_streaming_status_trigger ON public.streaming_sessions;
CREATE TRIGGER validate_streaming_status_trigger
  BEFORE UPDATE ON public.streaming_sessions
  FOR EACH ROW
  EXECUTE FUNCTION validate_streaming_session_status();