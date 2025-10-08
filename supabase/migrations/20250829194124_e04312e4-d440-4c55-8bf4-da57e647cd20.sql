-- Completely reset face_verifications RLS policies for security enhancement

-- Drop ALL existing policies for face_verifications table
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'face_verifications' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.face_verifications';
    END LOOP;
END $$;

-- Create secure function for accessing verification status (not raw biometric data)
CREATE OR REPLACE FUNCTION public.get_secure_verification_status(target_user_id uuid DEFAULT auth.uid())
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
  
  -- Strict user validation
  IF target_user_id != current_user_id OR current_user_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  
  -- Comprehensive audit logging
  PERFORM log_security_event(
    'face_verification_status_check', 
    'face_verification', 
    target_user_id,
    jsonb_build_object(
      'accessed_by', current_user_id,
      'timestamp', now(),
      'ip_address', inet_client_addr()::text,
      'data_type', 'status_only'
    )
  );
  
  -- Return minimal verification status (NO biometric data)
  SELECT jsonb_build_object(
    'verified', (status = 'verified'),
    'status', status,
    'provider', provider,
    'verification_date', created_at
  ) INTO result
  FROM public.face_verifications 
  WHERE user_id = target_user_id
    AND status IN ('verified', 'pending', 'failed')
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(result, jsonb_build_object('verified', false));
END;
$$;

-- New RLS policies with enhanced security and audit logging
CREATE POLICY "face_verifications_secure_insert_v2" 
ON public.face_verifications 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND user_id IS NOT NULL
  AND (
    SELECT log_security_event(
      'biometric_verification_created', 
      'face_verification', 
      auth.uid(),
      jsonb_build_object('provider', provider, 'timestamp', now())
    ) IS NULL
  )
);

CREATE POLICY "face_verifications_secure_select_v2" 
ON public.face_verifications 
FOR SELECT 
USING (
  auth.uid() = user_id 
  AND user_id IS NOT NULL
  AND (
    SELECT log_security_event(
      'biometric_data_access_attempt', 
      'face_verification', 
      auth.uid(),
      jsonb_build_object(
        'verification_id', id,
        'timestamp', now(),
        'ip_address', inet_client_addr()::text,
        'warning', 'direct_biometric_access'
      )
    ) IS NULL
  )
);

-- Strict policies to prevent modification/deletion of biometric data
CREATE POLICY "face_verifications_no_updates_v2" 
ON public.face_verifications 
FOR UPDATE 
USING (false);

CREATE POLICY "face_verifications_no_deletions_v2" 
ON public.face_verifications 
FOR DELETE 
USING (false);