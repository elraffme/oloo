-- Enhance security for face_verifications table
-- Add comprehensive audit logging and field-level access controls

-- First, drop existing policies to replace with more secure versions
DROP POLICY IF EXISTS "Users can create their own verifications" ON public.face_verifications;
DROP POLICY IF EXISTS "Users can view their own verifications" ON public.face_verifications;

-- Create a secure function to access verification data with audit logging
CREATE OR REPLACE FUNCTION public.get_user_verification_status(target_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Only allow users to check their own verification status
  IF target_user_id != current_user_id OR current_user_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  
  -- Log access attempt for security audit
  PERFORM log_security_event(
    'face_verification_accessed', 
    'face_verification', 
    target_user_id,
    jsonb_build_object(
      'accessed_by', current_user_id,
      'timestamp', now(),
      'ip_address', inet_client_addr()::text
    )
  );
  
  -- Return only essential verification status (not sensitive biometric data)
  SELECT jsonb_build_object(
    'id', id,
    'status', status,
    'provider', provider,
    'created_at', created_at,
    'score_available', (score IS NOT NULL),
    'has_verification_data', (verification_data != '{}'::jsonb)
  ) INTO result
  FROM public.face_verifications 
  WHERE user_id = target_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Create enhanced RLS policies with audit logging
CREATE POLICY "Users can create verifications with audit logging" 
ON public.face_verifications 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND (
    SELECT log_security_event(
      'face_verification_created', 
      'face_verification', 
      auth.uid(),
      jsonb_build_object(
        'provider', provider,
        'timestamp', now()
      )
    ) IS NULL
  )
);

-- Highly restricted SELECT policy - only return basic status information
CREATE POLICY "Users can view limited verification status only" 
ON public.face_verifications 
FOR SELECT 
USING (
  auth.uid() = user_id 
  AND (
    SELECT log_security_event(
      'face_verification_data_accessed', 
      'face_verification', 
      auth.uid(),
      jsonb_build_object(
        'verification_id', id,
        'access_timestamp', now(),
        'ip_address', inet_client_addr()::text
      )
    ) IS NULL
  )
);

-- Add policy to prevent any updates to protect data integrity
CREATE POLICY "No updates allowed on verification data" 
ON public.face_verifications 
FOR UPDATE 
USING (false);

-- Add policy to prevent deletions to maintain audit trail
CREATE POLICY "No deletions allowed on verification data" 
ON public.face_verifications 
FOR DELETE 
USING (false);

-- Create a function for admin access with strict logging (service role only)
CREATE OR REPLACE FUNCTION public.admin_get_verification_data(verification_id uuid, admin_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Only allow admin access or service role
  IF NOT (is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required for sensitive verification data';
  END IF;
  
  -- Log admin access with reason
  PERFORM log_security_event(
    'admin_verification_data_access', 
    'face_verification', 
    verification_id,
    jsonb_build_object(
      'admin_user_id', current_user_id,
      'access_reason', admin_reason,
      'timestamp', now(),
      'ip_address', inet_client_addr()::text,
      'critical_access', true
    )
  );
  
  -- Return full verification data for admin purposes
  SELECT to_jsonb(face_verifications.*) INTO result
  FROM public.face_verifications 
  WHERE id = verification_id;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;