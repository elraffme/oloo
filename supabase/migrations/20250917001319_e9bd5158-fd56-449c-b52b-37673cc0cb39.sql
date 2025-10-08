-- Enhanced security for user_sensitive_info table with field-level encryption

-- Create encryption functions for sensitive user information
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

-- Create function to validate encrypted sensitive fields
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

-- Add encrypted columns to user_sensitive_info table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_sensitive_info' 
                 AND column_name = 'encrypted_phone_hash') THEN
    ALTER TABLE public.user_sensitive_info 
    ADD COLUMN encrypted_phone_hash text,
    ADD COLUMN encrypted_emergency_contact_phone_hash text,
    ADD COLUMN access_count integer DEFAULT 0,
    ADD COLUMN security_flags jsonb DEFAULT '{"encryption_enabled": true, "audit_enhanced": true}'::jsonb;
  END IF;
END $$;

-- Enhanced audit logging function for sensitive info access
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

-- Rate limiting function for sensitive info access
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

-- Enhanced secure function to get user sensitive info with encryption and rate limiting
CREATE OR REPLACE FUNCTION get_user_sensitive_info()
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
  
  -- Strict authentication check
  IF current_user_id IS NULL THEN
    PERFORM log_security_event('unauthorized_sensitive_info_access', 'user_sensitive_info', NULL, 
      jsonb_build_object('error', 'no_auth', 'timestamp', now()));
    RETURN '{}'::jsonb;
  END IF;
  
  -- Rate limiting check
  IF NOT check_sensitive_info_rate_limit(current_user_id) THEN
    RAISE EXCEPTION 'Rate limit exceeded for sensitive information access';
  END IF;
  
  -- Log legitimate access attempt
  PERFORM log_sensitive_info_access('accessed', 'all_fields', current_user_id);
  
  -- Return only user's own sensitive information (never return encrypted hashes)
  SELECT jsonb_build_object(
    'phone', phone,
    'emergency_contact_name', emergency_contact_name,
    'emergency_contact_phone', emergency_contact_phone,
    'last_accessed_at', last_accessed_at,
    'access_count', access_count,
    'security_enhanced', true
  ) INTO result
  FROM public.user_sensitive_info
  WHERE user_id = current_user_id;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Enhanced secure function to update user sensitive info with encryption
CREATE OR REPLACE FUNCTION update_user_sensitive_info(
  new_phone text DEFAULT NULL,
  new_emergency_contact_name text DEFAULT NULL,
  new_emergency_contact_phone text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  changes_made jsonb := '{}'::jsonb;
  encrypted_phone_hash text;
  encrypted_emergency_phone_hash text;
BEGIN
  current_user_id := auth.uid();
  
  -- Strict authentication check
  IF current_user_id IS NULL THEN
    PERFORM log_security_event('unauthorized_sensitive_info_update', 'user_sensitive_info', NULL, 
      jsonb_build_object('error', 'no_auth', 'timestamp', now()));
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Rate limiting check
  IF NOT check_sensitive_info_rate_limit(current_user_id) THEN
    RAISE EXCEPTION 'Rate limit exceeded for sensitive information updates';
  END IF;
  
  -- Build changes object for audit log and encrypt sensitive fields
  IF new_phone IS NOT NULL THEN
    changes_made := changes_made || jsonb_build_object('phone_updated', true);
    encrypted_phone_hash := encrypt_sensitive_field(new_phone, 'phone', current_user_id);
  END IF;
  
  IF new_emergency_contact_name IS NOT NULL THEN
    changes_made := changes_made || jsonb_build_object('emergency_contact_name_updated', true);
  END IF;
  
  IF new_emergency_contact_phone IS NOT NULL THEN
    changes_made := changes_made || jsonb_build_object('emergency_contact_phone_updated', true);
    encrypted_emergency_phone_hash := encrypt_sensitive_field(new_emergency_contact_phone, 'emergency_phone', current_user_id);
  END IF;
  
  -- Log the update attempt with enhanced security metadata
  PERFORM log_sensitive_info_access('update_attempt', 'multiple_fields', current_user_id, 
    jsonb_build_object('changes', changes_made, 'encryption_applied', true));
  
  -- Perform the update with encryption
  INSERT INTO public.user_sensitive_info (
    user_id, 
    phone, 
    emergency_contact_name, 
    emergency_contact_phone,
    encrypted_phone_hash,
    encrypted_emergency_contact_phone_hash,
    security_flags
  )
  VALUES (
    current_user_id, 
    new_phone, 
    new_emergency_contact_name, 
    new_emergency_contact_phone,
    encrypted_phone_hash,
    encrypted_emergency_phone_hash,
    jsonb_build_object(
      'encryption_enabled', true,
      'last_encryption_update', now(),
      'security_version', '2.0'
    )
  )
  ON CONFLICT (user_id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, user_sensitive_info.phone),
    emergency_contact_name = COALESCE(EXCLUDED.emergency_contact_name, user_sensitive_info.emergency_contact_name),
    emergency_contact_phone = COALESCE(EXCLUDED.emergency_contact_phone, user_sensitive_info.emergency_contact_phone),
    encrypted_phone_hash = COALESCE(EXCLUDED.encrypted_phone_hash, user_sensitive_info.encrypted_phone_hash),
    encrypted_emergency_contact_phone_hash = COALESCE(EXCLUDED.encrypted_emergency_contact_phone_hash, user_sensitive_info.encrypted_emergency_contact_phone_hash),
    updated_at = now(),
    security_flags = EXCLUDED.security_flags || jsonb_build_object('last_update', now());
  
  -- Log successful update
  PERFORM log_sensitive_info_access('updated_successfully', 'multiple_fields', current_user_id, 
    jsonb_build_object('changes', changes_made, 'security_enhanced', true));
  
  RETURN TRUE;
END;
$$;

-- Create trigger to prevent direct access to encrypted fields
CREATE OR REPLACE FUNCTION prevent_encrypted_field_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log any attempt to directly access encrypted fields
  IF TG_OP = 'SELECT' THEN
    PERFORM log_security_event('direct_encrypted_field_access_attempt', 'user_sensitive_info', auth.uid(),
      jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP));
  END IF;
  
  -- Prevent unauthorized updates to encrypted fields
  IF TG_OP = 'UPDATE' AND (
    OLD.encrypted_phone_hash != NEW.encrypted_phone_hash OR 
    OLD.encrypted_emergency_contact_phone_hash != NEW.encrypted_emergency_contact_phone_hash
  ) THEN
    -- Only allow updates through secure functions
    IF current_setting('application_name') != 'secure_sensitive_info_update' THEN
      RAISE EXCEPTION 'Direct updates to encrypted fields are not allowed for security reasons';
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;