CREATE OR REPLACE FUNCTION public.max_stream_duration_sec(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE lower(COALESCE((
      SELECT m.tier FROM public.memberships m
      WHERE m.user_id = _user_id
        AND m.status = 'active'
        AND (m.expires_at IS NULL OR m.expires_at > now())
      ORDER BY m.updated_at DESC NULLS LAST
      LIMIT 1
    ), 'free'))
    WHEN 'platinum' THEN 0
    WHEN 'gold' THEN 14400
    WHEN 'premium' THEN 14400
    WHEN 'silver' THEN 3600
    ELSE 1800
  END;
$$;

GRANT EXECUTE ON FUNCTION public.max_stream_duration_sec(uuid) TO authenticated, service_role;