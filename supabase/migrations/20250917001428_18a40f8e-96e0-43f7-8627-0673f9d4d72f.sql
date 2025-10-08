-- Fix function search path security warnings for sensitive info functions

-- Update encrypt_sensitive_field function with fixed search path
CREATE OR REPLACE FUNCTION encrypt_sensitive_field(plaintext_data text, field_type text, user_uuid uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  encryption_key text;
  encrypted_result text;
BEGIN
  -- Generate a unique encryption key per user and field type
  encryption_key := encode(digest(
    COALESCE(user_uuid::text, 'system') || ':' || field_type || ':sensitive_data_encryption',
    'sha256'
  ), 'hex');
  
  -- Create a hash-based encryption (not reversible, for comparison only)
  encrypted_result := encode(
    digest(plaintext_data || ':' || encryption_key, 'sha256'),
    'base64'
  );
  
  RETURN encrypted_result;
END;
$$;

-- Update validate_sensitive_field function with fixed search path
CREATE OR REPLACE FUNCTION validate_sensitive_field(encrypted_data text, plaintext_data text, field_type text, user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  encryption_key text;
  expected_hash text;
BEGIN
  -- Recreate the encryption key
  encryption_key := encode(digest(
    COALESCE(user_uuid::text, 'system') || ':' || field_type || ':sensitive_data_encryption',
    'sha256'
  ), 'hex');
  
  -- Generate expected hash
  expected_hash := encode(
    digest(plaintext_data || ':' || encryption_key, 'sha256'),
    'base64'
  );
  
  RETURN encrypted_data = expected_hash;
END;
$$;

-- Update log_sensitive_info_access function with fixed search path
CREATE OR REPLACE FUNCTION log_sensitive_info_access(access_type text, field_accessed text, user_uuid uuid DEFAULT auth.uid(), additional_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Enhanced logging with detailed metadata for sensitive data access
  PERFORM log_security_event(
    'sensitive_info_' || access_type,
    'user_sensitive_info',
    user_uuid,
    jsonb_build_object(
      'field_accessed', field_accessed,
      'access_timestamp', now(),
      'ip_address', inet_client_addr()::text,
      'security_level', 'critical',
      'data_classification', 'pii_sensitive',
      'encryption_used', true,
      'access_method', 'secure_function'
    ) || additional_metadata
  );
  
  -- Update access counter
  UPDATE public.user_sensitive_info 
  SET access_count = access_count + 1,
      last_accessed_at = now()
  WHERE user_id = user_uuid;
END;
$$;

-- Update check_sensitive_info_rate_limit function with fixed search path
CREATE OR REPLACE FUNCTION check_sensitive_info_rate_limit(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recent_access_count integer;
  access_count_today integer;
BEGIN
  -- Check access attempts in last 10 minutes (max 5 attempts)
  SELECT COUNT(*) INTO recent_access_count
  FROM public.security_audit_log
  WHERE user_id = user_uuid 
    AND action LIKE 'sensitive_info_%'
    AND created_at >= (now() - interval '10 minutes');
    
  IF recent_access_count >= 5 THEN
    PERFORM log_security_event('sensitive_info_rate_limit_exceeded', 'user_sensitive_info', user_uuid, 
      jsonb_build_object('recent_attempts', recent_access_count, 'limit_type', 'short_term'));
    RETURN false;
  END IF;
  
  -- Check daily access limit (max 50 per day)
  SELECT COUNT(*) INTO access_count_today
  FROM public.security_audit_log
  WHERE user_id = user_uuid 
    AND action LIKE 'sensitive_info_%'
    AND created_at >= (now() - interval '24 hours');
    
  IF access_count_today >= 50 THEN
    PERFORM log_security_event('sensitive_info_daily_limit_exceeded', 'user_sensitive_info', user_uuid,
      jsonb_build_object('daily_attempts', access_count_today, 'limit_type', 'daily'));
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Update prevent_encrypted_field_access function with fixed search path
CREATE OR REPLACE FUNCTION prevent_encrypted_field_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log any attempt to directly access encrypted fields
  IF TG_OP = 'SELECT' THEN
    PERFORM log_security_event('direct_encrypted_field_access_attempt', 'user_sensitive_info', auth.uid(),
      jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP));
  END IF;
  
  -- Prevent unauthorized updates to encrypted fields
  IF TG_OP = 'UPDATE' AND (
    OLD.encrypted_phone_hash IS DISTINCT FROM NEW.encrypted_phone_hash OR 
    OLD.encrypted_emergency_contact_phone_hash IS DISTINCT FROM NEW.encrypted_emergency_contact_phone_hash
  ) THEN
    -- Only allow updates through secure functions
    IF current_setting('application_name') != 'secure_sensitive_info_update' THEN
      RAISE EXCEPTION 'Direct updates to encrypted fields are not allowed for security reasons';
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;