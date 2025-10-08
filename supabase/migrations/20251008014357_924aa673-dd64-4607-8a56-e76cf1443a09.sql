-- Create secure RPC function to get user's own sensitive info with access logging
CREATE OR REPLACE FUNCTION public.get_user_sensitive_info()
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
  
  -- Enforce authentication
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to access sensitive information';
  END IF;
  
  -- Log access attempt for security audit
  PERFORM log_security_event(
    'sensitive_info_accessed',
    'user_sensitive_info',
    current_user_id,
    jsonb_build_object(
      'timestamp', now(),
      'ip_address', inet_client_addr()::text,
      'security_level', 'critical',
      'data_classification', 'pii_sensitive'
    )
  );
  
  -- Update access tracking
  UPDATE public.user_sensitive_info
  SET 
    access_count = COALESCE(access_count, 0) + 1,
    last_accessed_at = now()
  WHERE user_id = current_user_id;
  
  -- Return only non-encrypted fields (encrypted fields should never be returned to client)
  SELECT jsonb_build_object(
    'phone', phone,
    'emergency_contact_name', emergency_contact_name,
    'emergency_contact_phone', emergency_contact_phone,
    'last_accessed_at', last_accessed_at
  ) INTO result
  FROM public.user_sensitive_info
  WHERE user_id = current_user_id;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Create secure RPC function to update user's own sensitive info with validation and logging
CREATE OR REPLACE FUNCTION public.update_user_sensitive_info(
  new_phone text DEFAULT NULL,
  new_emergency_contact_name text DEFAULT NULL,
  new_emergency_contact_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  result jsonb;
BEGIN
  current_user_id := auth.uid();
  
  -- Enforce authentication
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to update sensitive information';
  END IF;
  
  -- Validate phone number format (basic validation)
  IF new_phone IS NOT NULL AND LENGTH(new_phone) > 0 THEN
    IF LENGTH(new_phone) < 10 OR LENGTH(new_phone) > 20 THEN
      RAISE EXCEPTION 'Invalid phone number length';
    END IF;
  END IF;
  
  IF new_emergency_contact_phone IS NOT NULL AND LENGTH(new_emergency_contact_phone) > 0 THEN
    IF LENGTH(new_emergency_contact_phone) < 10 OR LENGTH(new_emergency_contact_phone) > 20 THEN
      RAISE EXCEPTION 'Invalid emergency contact phone number length';
    END IF;
  END IF;
  
  -- Log update attempt for security audit
  PERFORM log_security_event(
    'sensitive_info_updated',
    'user_sensitive_info',
    current_user_id,
    jsonb_build_object(
      'timestamp', now(),
      'ip_address', inet_client_addr()::text,
      'security_level', 'critical',
      'data_classification', 'pii_sensitive',
      'fields_updated', jsonb_build_object(
        'phone', (new_phone IS NOT NULL),
        'emergency_contact_name', (new_emergency_contact_name IS NOT NULL),
        'emergency_contact_phone', (new_emergency_contact_phone IS NOT NULL)
      )
    )
  );
  
  -- Upsert sensitive info with updated values
  INSERT INTO public.user_sensitive_info (
    user_id,
    phone,
    emergency_contact_name,
    emergency_contact_phone,
    updated_at,
    last_accessed_at,
    access_count
  ) VALUES (
    current_user_id,
    new_phone,
    new_emergency_contact_name,
    new_emergency_contact_phone,
    now(),
    now(),
    1
  )
  ON CONFLICT (user_id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, user_sensitive_info.phone),
    emergency_contact_name = COALESCE(EXCLUDED.emergency_contact_name, user_sensitive_info.emergency_contact_name),
    emergency_contact_phone = COALESCE(EXCLUDED.emergency_contact_phone, user_sensitive_info.emergency_contact_phone),
    updated_at = now();
  
  -- Return updated data
  SELECT jsonb_build_object(
    'phone', phone,
    'emergency_contact_name', emergency_contact_name,
    'emergency_contact_phone', emergency_contact_phone,
    'last_accessed_at', last_accessed_at,
    'success', true
  ) INTO result
  FROM public.user_sensitive_info
  WHERE user_id = current_user_id;
  
  RETURN COALESCE(result, jsonb_build_object('success', false));
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION public.get_user_sensitive_info IS 'Securely retrieves user''s own sensitive contact information with comprehensive access logging. CRITICAL: This function logs every access attempt to security_audit_log and updates access tracking fields.';
COMMENT ON FUNCTION public.update_user_sensitive_info IS 'Securely updates user''s own sensitive contact information with validation and logging. CRITICAL: This function validates input and logs all modification attempts to security_audit_log.';