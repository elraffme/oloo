-- Final security fix - Enable RLS on all remaining tables and fix function paths

-- Enable RLS on all tables that need it (remaining ones)
ALTER TABLE public.ar_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Update remaining functions with proper search path
CREATE OR REPLACE FUNCTION public.get_user_membership_tier(target_user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_tier TEXT;
BEGIN
  -- Ensure user can only check their own membership or function is called by system
  IF target_user_id != auth.uid() AND auth.uid() IS NOT NULL THEN
    RETURN 'free';
  END IF;
  
  SELECT tier INTO user_tier
  FROM public.memberships 
  WHERE user_id = target_user_id 
    AND status = 'active' 
    AND (expires_at IS NULL OR expires_at > now());
  
  RETURN COALESCE(user_tier, 'free');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_streams(target_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(stream_id uuid, title text, description text, status text, started_at timestamp with time zone, created_at timestamp with time zone, current_viewers integer, max_viewers integer, is_private boolean, ar_space_data jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only return user's own streams without stream_key
  RETURN QUERY
  SELECT 
    s.id,
    s.title,
    s.description,
    s.status,
    s.started_at,
    s.created_at,
    s.current_viewers,
    s.max_viewers,
    s.is_private,
    s.ar_space_data
  FROM public.streaming_sessions s
  WHERE s.host_user_id = target_user_id;
END;
$$;