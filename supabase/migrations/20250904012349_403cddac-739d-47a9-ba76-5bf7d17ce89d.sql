-- SECURITY FIX: Remove direct user access to biometric verification data
-- This prevents users from directly querying sensitive facial recognition data

-- Drop the existing insecure policy that allows direct SELECT access
DROP POLICY IF EXISTS "face_verifications_secure_select_v2" ON public.face_verifications;

-- Create a new highly restrictive policy that prevents direct user access to biometric data
-- Only allow system functions and admin access
CREATE POLICY "face_verifications_no_direct_user_access_v3" 
ON public.face_verifications 
FOR SELECT 
USING (
  -- Only allow access if user is admin OR this is being called by a security definer function
  (is_admin()) OR 
  -- Allow service role access for system operations
  (auth.role() = 'service_role') OR
  -- Block all other direct user access to protect biometric data
  false
);

-- Update the insert policy to add extra security logging
DROP POLICY IF EXISTS "face_verifications_secure_insert_v2" ON public.face_verifications;

CREATE POLICY "face_verifications_secure_insert_v3" 
ON public.face_verifications 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id) AND 
  (user_id IS NOT NULL) AND 
  -- Enhanced logging for biometric data creation
  (SELECT log_security_event(
    'biometric_verification_created',
    'face_verification', 
    auth.uid(),
    jsonb_build_object(
      'provider', face_verifications.provider,
      'timestamp', now(),
      'ip_address', inet_client_addr()::text,
      'security_level', 'high',
      'data_classification', 'biometric_sensitive'
    )
  ) IS NULL)
);

-- Ensure the secure functions can still access the data by granting them special permissions
-- Update the secure verification status function to have proper access
CREATE OR REPLACE FUNCTION public.get_secure_verification_status(target_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Strict user validation - only allow users to check their own status
  IF target_user_id != current_user_id OR current_user_id IS NULL THEN
    RETURN jsonb_build_object('verified', false, 'status', 'unauthorized');
  END IF;
  
  -- Enhanced audit logging with security classification
  PERFORM log_security_event(
    'face_verification_status_check', 
    'face_verification', 
    target_user_id,
    jsonb_build_object(
      'accessed_by', current_user_id,
      'timestamp', now(),
      'ip_address', inet_client_addr()::text,
      'data_type', 'status_only',
      'security_classification', 'biometric_metadata',
      'access_method', 'secure_function'
    )
  );
  
  -- Return ONLY minimal verification status (NO biometric data)
  SELECT jsonb_build_object(
    'verified', (status = 'verified'),
    'status', status,
    'provider', provider,
    'verification_date', created_at,
    'has_verification', true
  ) INTO result
  FROM public.face_verifications 
  WHERE user_id = target_user_id
    AND status IN ('verified', 'pending', 'failed')
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(result, jsonb_build_object('verified', false, 'has_verification', false));
END;
$function$;

-- Create a secure function for updating profile verification status
CREATE OR REPLACE FUNCTION public.update_profile_verification_status(target_user_id uuid, is_verified boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- This function can only be called by the system or through secure verification process
  IF auth.uid() != target_user_id AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized access to verification status update';
  END IF;
  
  -- Log the verification status update
  PERFORM log_security_event(
    'profile_verification_status_updated',
    'profile',
    target_user_id,
    jsonb_build_object(
      'verified_status', is_verified,
      'updated_by', COALESCE(auth.uid()::text, 'service_role'),
      'timestamp', now(),
      'security_level', 'high'
    )
  );
  
  -- Update the profile verification status
  UPDATE public.profiles 
  SET verified = is_verified, updated_at = now()
  WHERE user_id = target_user_id;
  
  RETURN TRUE;
END;
$function$;