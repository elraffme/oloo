-- Create increment and decrement functions for stream viewers
CREATE OR REPLACE FUNCTION public.increment_stream_viewers(p_stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.streaming_sessions
  SET current_viewers = COALESCE(current_viewers, 0) + 1
  WHERE id = p_stream_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_stream_viewers(p_stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.streaming_sessions
  SET current_viewers = GREATEST(COALESCE(current_viewers, 1) - 1, 0)
  WHERE id = p_stream_id;
END;
$$;