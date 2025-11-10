-- Create table to store streaming session analytics before deletion
CREATE TABLE IF NOT EXISTS public.streaming_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_session_id uuid NOT NULL,
  host_user_id uuid,
  title text,
  total_duration_minutes integer,
  peak_viewers integer,
  total_viewers integer,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.streaming_analytics ENABLE ROW LEVEL SECURITY;

-- Hosts can view their own analytics
CREATE POLICY "Hosts can view their streaming analytics"
ON public.streaming_analytics
FOR SELECT
USING (auth.uid() = host_user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_streaming_analytics_host ON public.streaming_analytics(host_user_id);
CREATE INDEX IF NOT EXISTS idx_streaming_analytics_created ON public.streaming_analytics(created_at);

-- Function to cleanup old ended streaming sessions
CREATE OR REPLACE FUNCTION cleanup_old_streaming_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- First, copy analytics data from old ended sessions
  INSERT INTO public.streaming_analytics (
    original_session_id,
    host_user_id,
    title,
    total_duration_minutes,
    peak_viewers,
    total_viewers,
    started_at,
    ended_at
  )
  SELECT 
    id,
    host_user_id,
    title,
    EXTRACT(EPOCH FROM (ended_at - started_at))/60 AS total_duration_minutes,
    current_viewers AS peak_viewers,
    current_viewers AS total_viewers,
    started_at,
    ended_at
  FROM public.streaming_sessions
  WHERE status = 'ended'
    AND ended_at < NOW() - INTERVAL '30 days'
    AND id NOT IN (SELECT original_session_id FROM public.streaming_analytics);

  -- Delete old ended sessions
  DELETE FROM public.streaming_sessions
  WHERE status = 'ended'
    AND ended_at < NOW() - INTERVAL '30 days';
END;
$$;