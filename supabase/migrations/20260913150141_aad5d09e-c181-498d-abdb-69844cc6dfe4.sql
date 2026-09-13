
ALTER TABLE public.streaming_sessions
  ADD COLUMN IF NOT EXISTS planned_duration_sec integer,
  ADD COLUMN IF NOT EXISTS duration_ends_at timestamp with time zone;

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
    ELSE 900
  END;
$$;

GRANT EXECUTE ON FUNCTION public.max_stream_duration_sec(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_stream_duration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_sec integer;
BEGIN
  max_sec := public.max_stream_duration_sec(NEW.host_user_id);

  -- Clamp the requested duration to the host's plan allowance.
  IF NEW.planned_duration_sec IS NULL OR NEW.planned_duration_sec <= 0 THEN
    NEW.planned_duration_sec := CASE WHEN max_sec = 0 THEN NULL ELSE max_sec END;
  ELSIF max_sec > 0 AND NEW.planned_duration_sec > max_sec THEN
    NEW.planned_duration_sec := max_sec;
  END IF;

  -- Anchor the hard end time to the server clock once the stream goes live.
  IF NEW.status = 'live' AND NEW.planned_duration_sec IS NOT NULL THEN
    IF NEW.duration_ends_at IS NULL
       OR TG_OP = 'INSERT'
       OR COALESCE(OLD.status, '') <> 'live' THEN
      NEW.duration_ends_at := COALESCE(NEW.started_at, now()) + make_interval(secs => NEW.planned_duration_sec);
    ELSE
      NEW.duration_ends_at := OLD.duration_ends_at;
    END IF;
  ELSIF NEW.status <> 'live' THEN
    NEW.duration_ends_at := CASE WHEN TG_OP = 'UPDATE' THEN OLD.duration_ends_at ELSE NULL END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_stream_duration_trg ON public.streaming_sessions;
CREATE TRIGGER enforce_stream_duration_trg
BEFORE INSERT OR UPDATE ON public.streaming_sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_stream_duration();

CREATE OR REPLACE FUNCTION public.end_expired_streams()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ended_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.streaming_sessions
    SET status = 'ended',
        ended_at = now(),
        current_viewers = 0
    WHERE status = 'live'
      AND duration_ends_at IS NOT NULL
      AND duration_ends_at <= now()
    RETURNING id
  )
  SELECT count(*) INTO ended_count FROM expired;
  RETURN ended_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_expired_streams() TO authenticated, service_role;
