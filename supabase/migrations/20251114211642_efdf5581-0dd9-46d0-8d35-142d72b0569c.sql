-- Create stream viewer sessions table to track all viewers (authenticated and guests)
CREATE TABLE IF NOT EXISTS public.stream_viewer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.streaming_sessions(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_display_name text NOT NULL,
  session_token text NOT NULL UNIQUE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  is_guest boolean NOT NULL DEFAULT false,
  CONSTRAINT valid_viewer_type CHECK (
    (is_guest = true AND viewer_id IS NULL) OR 
    (is_guest = false AND viewer_id IS NOT NULL)
  )
);

-- Create index for fast lookups
CREATE INDEX idx_stream_viewer_sessions_stream_id ON public.stream_viewer_sessions(stream_id);
CREATE INDEX idx_stream_viewer_sessions_active ON public.stream_viewer_sessions(stream_id) WHERE left_at IS NULL;
CREATE INDEX idx_stream_viewer_sessions_token ON public.stream_viewer_sessions(session_token);

-- Enable RLS
ALTER TABLE public.stream_viewer_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can see active viewers for public streams
CREATE POLICY "anyone_can_see_public_stream_viewers" ON public.stream_viewer_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.streaming_sessions
      WHERE id = stream_viewer_sessions.stream_id
        AND is_private = false
        AND status = 'live'
    )
  );

-- RLS Policy: Anyone can join as viewer (insert their own session)
CREATE POLICY "anyone_can_join_public_streams" ON public.stream_viewer_sessions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.streaming_sessions
      WHERE id = stream_viewer_sessions.stream_id
        AND is_private = false
        AND status = 'live'
    )
  );

-- RLS Policy: Users can update their own sessions (heartbeat, leave)
CREATE POLICY "users_can_update_own_session" ON public.stream_viewer_sessions
  FOR UPDATE
  USING (
    (is_guest = false AND viewer_id = auth.uid()) OR
    session_token = current_setting('request.jwt.claims', true)::json->>'session_token'
  );

-- Update RLS for streaming_sessions to allow unauthenticated viewing
DROP POLICY IF EXISTS "viewers_can_see_all_public_live_streams" ON public.streaming_sessions;

CREATE POLICY "anyone_can_see_public_live_streams" ON public.streaming_sessions
  FOR SELECT
  USING (is_private = false AND status = 'live');

-- Function to join stream as viewer
CREATE OR REPLACE FUNCTION public.join_stream_as_viewer(
  p_stream_id uuid,
  p_display_name text,
  p_is_guest boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session_token text;
  v_viewer_id uuid;
  v_session_id uuid;
BEGIN
  -- Generate unique session token
  v_session_token := encode(gen_random_bytes(32), 'hex');
  
  -- Get viewer_id for authenticated users
  IF NOT p_is_guest THEN
    v_viewer_id := auth.uid();
    IF v_viewer_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required for non-guest viewers';
    END IF;
  END IF;
  
  -- Create viewer session
  INSERT INTO public.stream_viewer_sessions (
    stream_id,
    viewer_id,
    viewer_display_name,
    session_token,
    is_guest
  ) VALUES (
    p_stream_id,
    v_viewer_id,
    p_display_name,
    v_session_token,
    p_is_guest
  )
  RETURNING id INTO v_session_id;
  
  -- Increment viewer count
  PERFORM increment_stream_viewers(p_stream_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'session_token', v_session_token,
    'viewer_id', v_viewer_id,
    'is_guest', p_is_guest
  );
END;
$$;

-- Function to update viewer heartbeat
CREATE OR REPLACE FUNCTION public.update_viewer_heartbeat(p_session_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.stream_viewer_sessions
  SET last_heartbeat = now()
  WHERE session_token = p_session_token
    AND left_at IS NULL;
  
  RETURN FOUND;
END;
$$;

-- Function to leave stream
CREATE OR REPLACE FUNCTION public.leave_stream_viewer(p_session_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stream_id uuid;
BEGIN
  -- Mark session as left
  UPDATE public.stream_viewer_sessions
  SET left_at = now()
  WHERE session_token = p_session_token
    AND left_at IS NULL
  RETURNING stream_id INTO v_stream_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Decrement viewer count
  PERFORM decrement_stream_viewers(v_stream_id);
  
  RETURN true;
END;
$$;

-- Function to get active viewers for a stream
CREATE OR REPLACE FUNCTION public.get_active_stream_viewers(p_stream_id uuid)
RETURNS TABLE(
  session_id uuid,
  viewer_id uuid,
  viewer_display_name text,
  is_guest boolean,
  joined_at timestamptz,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    svs.id,
    svs.viewer_id,
    svs.viewer_display_name,
    svs.is_guest,
    svs.joined_at,
    CASE 
      WHEN svs.is_guest THEN '/placeholder.svg'
      ELSE COALESCE(
        (p.profile_photos->0)::text,
        p.avatar_url,
        '/placeholder.svg'
      )
    END as avatar_url
  FROM public.stream_viewer_sessions svs
  LEFT JOIN public.profiles p ON svs.viewer_id = p.user_id
  WHERE svs.stream_id = p_stream_id
    AND svs.left_at IS NULL
    AND svs.last_heartbeat > now() - interval '2 minutes'
  ORDER BY svs.joined_at ASC;
END;
$$;

-- Cleanup function for stale viewer sessions (called by cron)
CREATE OR REPLACE FUNCTION public.cleanup_stale_viewer_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark sessions as left if heartbeat is stale
  UPDATE public.stream_viewer_sessions
  SET left_at = last_heartbeat
  WHERE left_at IS NULL
    AND last_heartbeat < now() - interval '2 minutes';
  
  -- Update viewer counts for affected streams
  UPDATE public.streaming_sessions s
  SET current_viewers = (
    SELECT COUNT(*)
    FROM public.stream_viewer_sessions svs
    WHERE svs.stream_id = s.id
      AND svs.left_at IS NULL
      AND svs.last_heartbeat > now() - interval '2 minutes'
  )
  WHERE s.status = 'live';
END;
$$;