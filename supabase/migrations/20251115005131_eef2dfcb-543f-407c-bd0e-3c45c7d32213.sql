-- Fix join_stream_as_viewer to use extensions.gen_random_bytes and correct search_path
CREATE OR REPLACE FUNCTION public.join_stream_as_viewer(
  p_stream_id uuid,
  p_display_name text,
  p_is_guest boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session_token text;
  v_viewer_id uuid;
  v_session_id uuid;
BEGIN
  -- Generate unique session token using pgcrypto in extensions schema
  v_session_token := encode(gen_random_bytes(32), 'hex');

  -- Determine viewer_id for authenticated users
  IF NOT p_is_guest THEN
    v_viewer_id := auth.uid();
    IF v_viewer_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required for non-guest viewers';
    END IF;
  END IF;

  -- Create viewer session row
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

  -- Increment aggregate viewer count
  PERFORM public.increment_stream_viewers(p_stream_id);

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'session_token', v_session_token,
    'viewer_id', v_viewer_id,
    'is_guest', p_is_guest
  );
END;
$$;

-- Fix get_active_stream_viewers to index text[] correctly
CREATE OR REPLACE FUNCTION public.get_active_stream_viewers(
  p_stream_id uuid
)
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
SET search_path = public
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
        p.profile_photos[1],
        p.avatar_url,
        '/placeholder.svg'
      )
    END AS avatar_url
  FROM public.stream_viewer_sessions svs
  LEFT JOIN public.profiles p ON svs.viewer_id = p.user_id
  WHERE svs.stream_id = p_stream_id
    AND svs.left_at IS NULL
    AND svs.last_heartbeat > now() - interval '2 minutes'
  ORDER BY svs.joined_at ASC;
END;
$$;
