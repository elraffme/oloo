-- Fix face verification security - handle existing policies properly

-- Drop all existing policies with correct names
DROP POLICY IF EXISTS "Users can create verifications with audit logging" ON public.face_verifications;
DROP POLICY IF EXISTS "Users can view limited verification status only" ON public.face_verifications;
DROP POLICY IF EXISTS "No updates allowed on verification data" ON public.face_verifications;  
DROP POLICY IF EXISTS "No deletions allowed on verification data" ON public.face_verifications;

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

-- Create new secure RLS policies with unique names
CREATE POLICY "Secure verification creation with logging" 
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

-- Restricted SELECT policy that logs access and limits data exposure
CREATE POLICY "Secure verification status access with audit" 
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

-- Prevent updates to maintain data integrity
CREATE POLICY "Block verification data updates" 
ON public.face_verifications 
FOR UPDATE 
USING (false);

-- Prevent deletions to maintain audit trail
CREATE POLICY "Block verification data deletions" 
ON public.face_verifications 
FOR DELETE 
USING (false);