CREATE OR REPLACE FUNCTION public.join_waitlist(
  _name text,
  _email text,
  _username text DEFAULT NULL,
  _referred_by_code text DEFAULT NULL,
  _source text DEFAULT 'landing'
)
RETURNS TABLE(referral_code text, already_exists boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_email text := lower(trim(_email));
BEGIN
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email' USING ERRCODE = '22023';
  END IF;

  SELECT w.referral_code INTO v_code FROM public.waitlist w WHERE w.email = v_email;
  IF v_code IS NOT NULL THEN
    RETURN QUERY SELECT v_code, true;
    RETURN;
  END IF;

  INSERT INTO public.waitlist (name, email, username, referred_by_code, source)
  VALUES (trim(_name), v_email, NULLIF(trim(_username), ''), NULLIF(trim(_referred_by_code), ''), COALESCE(_source, 'landing'))
  RETURNING waitlist.referral_code INTO v_code;

  RETURN QUERY SELECT v_code, false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_waitlist(text, text, text, text, text) TO anon, authenticated;