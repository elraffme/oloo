CREATE TABLE public.vibe_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  vibe text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vibe_checks_unique_pair UNIQUE (user_id, target_user_id),
  CONSTRAINT vibe_checks_not_self CHECK (user_id <> target_user_id),
  CONSTRAINT vibe_checks_vibe_valid CHECK (vibe IN ('ignite', 'pass'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vibe_checks TO authenticated;
GRANT ALL ON public.vibe_checks TO service_role;

ALTER TABLE public.vibe_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vibe checks"
  ON public.vibe_checks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own vibe checks"
  ON public.vibe_checks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vibe checks"
  ON public.vibe_checks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vibe checks"
  ON public.vibe_checks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_vibe_checks_user ON public.vibe_checks (user_id);
CREATE INDEX idx_vibe_checks_target ON public.vibe_checks (target_user_id);

CREATE TRIGGER update_vibe_checks_updated_at
  BEFORE UPDATE ON public.vibe_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_vibe_check(_target_user_id uuid, _vibe text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _mutual boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
  END IF;

  IF _user_id = _target_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'You cannot vibe check yourself');
  END IF;

  IF _vibe NOT IN ('ignite', 'pass') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid vibe');
  END IF;

  INSERT INTO public.vibe_checks (user_id, target_user_id, vibe)
  VALUES (_user_id, _target_user_id, _vibe)
  ON CONFLICT (user_id, target_user_id)
  DO UPDATE SET vibe = EXCLUDED.vibe, updated_at = now();

  IF _vibe = 'ignite' THEN
    INSERT INTO public.user_connections (user_id, connected_user_id, connection_type)
    SELECT _user_id, _target_user_id, 'like'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_connections
      WHERE user_id = _user_id
        AND connected_user_id = _target_user_id
        AND connection_type = 'like'
    );

    SELECT EXISTS (
      SELECT 1 FROM public.vibe_checks
      WHERE user_id = _target_user_id
        AND target_user_id = _user_id
        AND vibe = 'ignite'
    ) INTO _mutual;
  END IF;

  RETURN jsonb_build_object('success', true, 'vibe', _vibe, 'mutual', _mutual);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_vibe_check(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_vibe_check(uuid, text) TO service_role;