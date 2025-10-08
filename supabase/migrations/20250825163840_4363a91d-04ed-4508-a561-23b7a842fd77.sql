-- Fix database functions with proper search_path (CRITICAL SECURITY FIX)
-- This prevents SQL injection and ensures function security

-- Update functions to have immutable search_path
CREATE OR REPLACE FUNCTION public.get_user_token_balance(target_user_id uuid DEFAULT auth.uid())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_balance integer;
BEGIN
  -- Only allow users to check their own balance
  IF target_user_id != auth.uid() THEN
    RETURN 0;
  END IF;
  
  SELECT balance INTO current_balance
  FROM public.token_transactions 
  WHERE user_id = target_user_id 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  RETURN COALESCE(current_balance, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_membership_tier(target_user_id uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Secure gift catalog access (CRITICAL: prevent business model scraping)
-- Restrict gifts table to authenticated users only
DROP POLICY IF EXISTS "Anyone can view gifts catalog" ON public.gifts;
CREATE POLICY "Authenticated users can view gifts catalog"
ON public.gifts
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Add rate limiting for face verification attempts (SECURITY: prevent abuse)
CREATE TABLE IF NOT EXISTS public.verification_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  attempt_count integer DEFAULT 1,
  last_attempt_at timestamp with time zone DEFAULT now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.verification_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their verification attempts"
ON public.verification_attempts
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Function to check verification rate limits
CREATE OR REPLACE FUNCTION public.check_verification_rate_limit(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_attempts integer;
  last_attempt timestamp with time zone;
  blocked_until_time timestamp with time zone;
BEGIN
  -- Get current attempt data
  SELECT attempt_count, last_attempt_at, blocked_until
  INTO current_attempts, last_attempt, blocked_until_time
  FROM public.verification_attempts 
  WHERE user_id = user_uuid;
  
  -- Check if user is currently blocked
  IF blocked_until_time IS NOT NULL AND blocked_until_time > now() THEN
    RETURN false;
  END IF;
  
  -- If no record exists or last attempt was over 1 hour ago, reset counter
  IF current_attempts IS NULL OR last_attempt < (now() - interval '1 hour') THEN
    INSERT INTO public.verification_attempts (user_id, attempt_count, last_attempt_at)
    VALUES (user_uuid, 1, now())
    ON CONFLICT (user_id) DO UPDATE SET
      attempt_count = 1,
      last_attempt_at = now(),
      blocked_until = NULL;
    RETURN true;
  END IF;
  
  -- Increment attempt count
  current_attempts := current_attempts + 1;
  
  -- Block user if they exceed 3 attempts per hour
  IF current_attempts >= 3 THEN
    UPDATE public.verification_attempts 
    SET attempt_count = current_attempts,
        last_attempt_at = now(),
        blocked_until = now() + interval '2 hours'
    WHERE user_id = user_uuid;
    RETURN false;
  END IF;
  
  -- Update attempt count
  UPDATE public.verification_attempts 
  SET attempt_count = current_attempts,
      last_attempt_at = now()
  WHERE user_id = user_uuid;
  
  RETURN true;
END;
$function$;

-- Restrict demo profiles access with pagination (SECURITY: prevent mass scraping)
CREATE OR REPLACE FUNCTION public.get_demo_profiles_paginated(page_size integer DEFAULT 10, page_offset integer DEFAULT 0)
RETURNS SETOF public.demo_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT * FROM public.demo_profiles 
  WHERE auth.uid() IS NOT NULL  -- Only authenticated users
  ORDER BY created_at DESC
  LIMIT page_size
  OFFSET page_offset;
$function$;