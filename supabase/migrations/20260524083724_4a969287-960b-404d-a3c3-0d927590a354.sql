-- Waitlist table
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT,
  referral_code TEXT NOT NULL UNIQUE DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  referred_by_code TEXT,
  referral_count INTEGER NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'website',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_email ON public.waitlist(email);
CREATE INDEX idx_waitlist_referral_code ON public.waitlist(referral_code);
CREATE INDEX idx_waitlist_referred_by ON public.waitlist(referred_by_code);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can join (insert) the waitlist
CREATE POLICY "Anyone can join the waitlist"
  ON public.waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can view full waitlist
CREATE POLICY "Admins can view waitlist"
  ON public.waitlist FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER update_waitlist_updated_at
  BEFORE UPDATE ON public.waitlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public count function (safe, no PII)
CREATE OR REPLACE FUNCTION public.get_waitlist_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.waitlist;
$$;

GRANT EXECUTE ON FUNCTION public.get_waitlist_count() TO anon, authenticated;

-- Increment referrer count when someone signs up via referral
CREATE OR REPLACE FUNCTION public.handle_waitlist_referral()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referred_by_code IS NOT NULL THEN
    UPDATE public.waitlist
    SET referral_count = referral_count + 1
    WHERE referral_code = NEW.referred_by_code;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_waitlist_referral
  AFTER INSERT ON public.waitlist
  FOR EACH ROW EXECUTE FUNCTION public.handle_waitlist_referral();