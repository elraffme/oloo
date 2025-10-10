-- Security Enhancement Migration: Rate Limiting, Tiered Profile Visibility, and Audit Improvements
-- This migration addresses critical security vulnerabilities identified in the security audit

-- =====================================================
-- 1. RATE LIMITING INFRASTRUCTURE
-- =====================================================

-- Create rate_limit_actions table to track user actions
CREATE TABLE IF NOT EXISTS public.rate_limit_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('profile_view', 'message_send', 'friend_request', 'search_query')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_user_action_time 
  ON public.rate_limit_actions(user_id, action_type, created_at DESC);

-- Enable RLS on rate_limit_actions
ALTER TABLE public.rate_limit_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own rate limit data
CREATE POLICY "Users can view own rate limit data"
  ON public.rate_limit_actions
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: System can insert rate limit records
CREATE POLICY "System can insert rate limit records"
  ON public.rate_limit_actions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 2. RATE LIMITING FUNCTIONS
-- =====================================================

-- Function to check rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_action_type TEXT,
  p_max_attempts INTEGER,
  p_window_minutes INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_count INTEGER;
  oldest_allowed_time TIMESTAMP WITH TIME ZONE;
  reset_time TIMESTAMP WITH TIME ZONE;
  result JSONB;
BEGIN
  -- Calculate the time window
  oldest_allowed_time := now() - (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Count actions in the time window
  SELECT COUNT(*) INTO action_count
  FROM public.rate_limit_actions
  WHERE user_id = p_user_id
    AND action_type = p_action_type
    AND created_at >= oldest_allowed_time;
  
  -- Calculate reset time (oldest action + window)
  SELECT created_at + (p_window_minutes || ' minutes')::INTERVAL INTO reset_time
  FROM public.rate_limit_actions
  WHERE user_id = p_user_id
    AND action_type = p_action_type
    AND created_at >= oldest_allowed_time
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- Build result
  result := jsonb_build_object(
    'allowed', action_count < p_max_attempts,
    'current_count', action_count,
    'remaining', GREATEST(0, p_max_attempts - action_count),
    'reset_at', reset_time
  );
  
  -- Log if limit exceeded
  IF action_count >= p_max_attempts THEN
    PERFORM log_security_event(
      'rate_limit_exceeded',
      'rate_limit',
      p_user_id,
      jsonb_build_object(
        'action_type', p_action_type,
        'attempt_count', action_count,
        'max_attempts', p_max_attempts,
        'window_minutes', p_window_minutes
      )
    );
  END IF;
  
  RETURN result;
END;
$$;

-- Function to record rate-limited actions
CREATE OR REPLACE FUNCTION public.record_rate_limit_action(
  p_user_id UUID,
  p_action_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rate_limit_actions (
    user_id,
    action_type,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_action_type,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  );
END;
$$;

-- =====================================================
-- 3. TIERED PROFILE VISIBILITY (DISCOVERY vs FULL)
-- =====================================================

-- Function to get limited profile for discovery (non-connected users)
CREATE OR REPLACE FUNCTION public.get_discovery_profile_preview(profile_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  first_name TEXT;
  city_only TEXT;
BEGIN
  -- Extract first name only
  SELECT split_part(display_name, ' ', 1) INTO first_name
  FROM public.profiles
  WHERE user_id = profile_user_id;
  
  -- Extract city only (before comma)
  SELECT split_part(location, ',', 1) INTO city_only
  FROM public.profiles
  WHERE user_id = profile_user_id;
  
  -- Return limited preview data for discovery
  SELECT jsonb_build_object(
    'id', id,
    'user_id', user_id,
    'display_name', first_name,  -- First name only
    'age', age,
    'location', city_only,  -- City only, not exact address
    'profile_photo_preview', 
      CASE 
        WHEN profile_photos IS NOT NULL AND array_length(profile_photos, 1) > 0 
        THEN profile_photos[1]  -- Only first photo
        ELSE avatar_url
      END,
    'interests_preview', 
      CASE 
        WHEN interests IS NOT NULL AND array_length(interests, 1) > 0
        THEN (SELECT array_agg(interest) FROM unnest(interests) AS interest LIMIT 3)  -- Only 3 interests
        ELSE ARRAY[]::TEXT[]
      END,
    'verified', verified,
    'bio_preview', 
      CASE 
        WHEN bio IS NOT NULL AND length(bio) > 100
        THEN substring(bio, 1, 100) || '...'  -- Truncated bio
        ELSE bio
      END,
    'is_demo_profile', is_demo_profile
  ) INTO result
  FROM public.profiles
  WHERE user_id = profile_user_id;
  
  -- Log discovery access for audit trail
  PERFORM log_security_event(
    'profile_discovery_preview_accessed',
    'profile',
    profile_user_id,
    jsonb_build_object(
      'accessed_by', auth.uid(),
      'preview_mode', true,
      'data_limited', true
    )
  );
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- =====================================================
-- 4. ENHANCED AUDIT LOGGING
-- =====================================================

-- Add index for faster audit log queries
CREATE INDEX IF NOT EXISTS idx_security_audit_critical_actions
  ON public.security_audit_log(action, created_at DESC)
  WHERE action IN ('profile_discovery_preview_accessed', 'rate_limit_exceeded', 'bulk_profile_access_detected');

-- Function to detect and flag bulk profile scraping attempts
CREATE OR REPLACE FUNCTION public.detect_bulk_profile_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_views INTEGER;
BEGIN
  -- Count profile views in last 5 minutes
  SELECT COUNT(*) INTO recent_views
  FROM public.rate_limit_actions
  WHERE user_id = NEW.user_id
    AND action_type = 'profile_view'
    AND created_at >= now() - INTERVAL '5 minutes';
  
  -- Flag if user views more than 20 profiles in 5 minutes
  IF recent_views > 20 THEN
    PERFORM log_security_event(
      'bulk_profile_access_detected',
      'profile',
      NEW.user_id,
      jsonb_build_object(
        'profile_views_5min', recent_views,
        'potential_scraping', true,
        'severity', 'high',
        'ip_address', inet_client_addr()::text
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to detect bulk access
DROP TRIGGER IF EXISTS trigger_detect_bulk_access ON public.rate_limit_actions;
CREATE TRIGGER trigger_detect_bulk_access
  AFTER INSERT ON public.rate_limit_actions
  FOR EACH ROW
  WHEN (NEW.action_type = 'profile_view')
  EXECUTE FUNCTION public.detect_bulk_profile_access();

-- =====================================================
-- 5. STORAGE BUCKET SECURITY
-- =====================================================

-- Ensure profile-photos bucket exists and is properly configured
-- Note: This assumes the bucket already exists. If not, create it via Supabase dashboard

-- Enhanced RLS policies for storage.objects (profile-photos bucket)
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;

-- Policy: Users can only upload to their own folder
CREATE POLICY "Users can upload to own folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (storage.foldername(name))[1] IS NOT NULL
  );

-- Policy: Authenticated users can view profile photos (needed for discovery)
-- But logged access for audit trail
CREATE POLICY "Authenticated users can view profile photos"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'profile-photos'
    AND auth.uid() IS NOT NULL
  );

-- Policy: Users can update only their own photos
CREATE POLICY "Users can update own photos"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'profile-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can delete only their own photos
CREATE POLICY "Users can delete own photos"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'profile-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- =====================================================
-- 6. ENHANCED MESSAGE SECURITY
-- =====================================================

-- Add rate limit tracking trigger for messages
CREATE OR REPLACE FUNCTION public.track_message_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Record message send action for rate limiting
  INSERT INTO public.rate_limit_actions (
    user_id,
    action_type,
    ip_address,
    metadata
  ) VALUES (
    NEW.sender_id,
    'message_send',
    inet_client_addr(),
    jsonb_build_object(
      'receiver_id', NEW.receiver_id,
      'message_type', NEW.message_type
    )
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_track_message_rate ON public.messages;
CREATE TRIGGER trigger_track_message_rate
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.track_message_rate_limit();

-- =====================================================
-- 7. BIOMETRIC DATA ENHANCED PROTECTION
-- =====================================================

-- Add additional access control for face_verifications
-- Require explicit reason for admin access

CREATE OR REPLACE FUNCTION public.admin_access_biometric_data(
  verification_id UUID,
  access_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Check admin role
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  -- Require non-empty reason
  IF access_reason IS NULL OR trim(access_reason) = '' THEN
    RAISE EXCEPTION 'Access reason is required for biometric data access';
  END IF;
  
  -- Log access with detailed audit trail
  PERFORM log_security_event(
    'biometric_data_admin_access',
    'face_verification',
    verification_id,
    jsonb_build_object(
      'admin_user_id', auth.uid(),
      'access_reason', access_reason,
      'ip_address', inet_client_addr()::text,
      'timestamp', now(),
      'data_classification', 'biometric_sensitive',
      'compliance_notice', 'GDPR Article 9 - Special Category Data'
    )
  );
  
  -- Return verification data (admin only)
  SELECT to_jsonb(face_verifications.*) INTO result
  FROM public.face_verifications
  WHERE id = verification_id;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- =====================================================
-- 8. GRANT EXECUTE PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.check_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_rate_limit_action TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discovery_profile_preview TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_access_biometric_data TO authenticated;
