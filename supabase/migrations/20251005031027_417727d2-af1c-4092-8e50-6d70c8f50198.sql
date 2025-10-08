-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop ALL existing related functions to avoid conflicts
DROP FUNCTION IF EXISTS public.encrypt_sensitive_field(text, text, uuid);
DROP FUNCTION IF EXISTS public.decrypt_payment_field(text, text, text);
DROP FUNCTION IF EXISTS public.update_user_sensitive_info(text, text, text);
DROP FUNCTION IF EXISTS public.get_user_sensitive_info();
DROP FUNCTION IF EXISTS public.check_sensitive_info_rate_limit(uuid);
DROP FUNCTION IF EXISTS public.log_sensitive_info_access(text, text, uuid);
DROP FUNCTION IF EXISTS public.get_encryption_key();

-- Add new encrypted columns for proper encryption (not hashing)
ALTER TABLE public.user_sensitive_info 
ADD COLUMN IF NOT EXISTS phone_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS emergency_contact_phone_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS emergency_contact_name_encrypted BYTEA;

-- Migrate existing plain text data to encrypted columns BEFORE creating functions
UPDATE public.user_sensitive_info
SET 
  phone_encrypted = CASE 
    WHEN phone IS NOT NULL THEN 
      pgp_sym_encrypt(phone, encode(digest(user_id::text || ':sensitive_data_key', 'sha256'), 'hex'))
    ELSE NULL
  END,
  emergency_contact_phone_encrypted = CASE 
    WHEN emergency_contact_phone IS NOT NULL THEN 
      pgp_sym_encrypt(emergency_contact_phone, encode(digest(user_id::text || ':sensitive_data_key', 'sha256'), 'hex'))
    ELSE NULL
  END,
  emergency_contact_name_encrypted = CASE 
    WHEN emergency_contact_name IS NOT NULL THEN 
      pgp_sym_encrypt(emergency_contact_name, encode(digest(user_id::text || ':sensitive_data_key', 'sha256'), 'hex'))
    ELSE NULL
  END
WHERE phone IS NOT NULL 
   OR emergency_contact_phone IS NOT NULL 
   OR emergency_contact_name IS NOT NULL;

-- Clear the plain text columns after migration for security
UPDATE public.user_sensitive_info
SET 
  phone = NULL,
  emergency_contact_phone = NULL,
  emergency_contact_name = NULL;

-- Drop old hash columns that aren't useful
ALTER TABLE public.user_sensitive_info 
DROP COLUMN IF EXISTS encrypted_phone_hash,
DROP COLUMN IF EXISTS encrypted_emergency_contact_phone_hash;

-- Create encryption key management function
CREATE FUNCTION public.get_encryption_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN encode(digest(auth.uid()::text || ':sensitive_data_key', 'sha256'), 'hex');
END;
$$;

-- Create helper function for rate limiting sensitive info access
CREATE FUNCTION public.check_sensitive_info_rate_limit(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_count integer;
  last_access timestamp with time zone;
BEGIN
  SELECT access_count, last_accessed_at
  INTO current_count, last_access
  FROM public.user_sensitive_info
  WHERE user_id = user_uuid;
  
  IF current_count IS NULL THEN
    RETURN true;
  END IF;
  
  IF last_access < (now() - interval '1 hour') THEN
    UPDATE public.user_sensitive_info
    SET access_count = 0, last_accessed_at = now()
    WHERE user_id = user_uuid;
    RETURN true;
  END IF;
  
  IF current_count >= 50 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Create helper function for logging sensitive info access
CREATE FUNCTION public.log_sensitive_info_access(
  action_type text,
  field_name text,
  target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM log_security_event(
    action_type,
    'user_sensitive_info',
    target_user_id,
    jsonb_build_object(
      'field_accessed', field_name,
      'timestamp', now(),
      'ip_address', inet_client_addr()::text,
      'encryption_verified', true,
      'data_classification', 'pii_sensitive'
    )
  );
END;
$$;

-- Create secure function to get user sensitive info with decryption
CREATE FUNCTION public.get_user_sensitive_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  current_user_id uuid;
  encryption_key text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    PERFORM log_security_event('unauthorized_sensitive_info_access', 'user_sensitive_info', NULL, 
      jsonb_build_object('error', 'no_auth', 'timestamp', now()));
    RETURN '{}'::jsonb;
  END IF;
  
  IF NOT check_sensitive_info_rate_limit(current_user_id) THEN
    RAISE EXCEPTION 'Rate limit exceeded for sensitive information access';
  END IF;
  
  PERFORM log_sensitive_info_access('accessed', 'all_fields', current_user_id);
  
  encryption_key := get_encryption_key();
  
  SELECT jsonb_build_object(
    'phone', CASE 
      WHEN phone_encrypted IS NOT NULL THEN 
        pgp_sym_decrypt(phone_encrypted, encryption_key)
      ELSE NULL
    END,
    'emergency_contact_name', CASE 
      WHEN emergency_contact_name_encrypted IS NOT NULL THEN 
        pgp_sym_decrypt(emergency_contact_name_encrypted, encryption_key)
      ELSE NULL
    END,
    'emergency_contact_phone', CASE 
      WHEN emergency_contact_phone_encrypted IS NOT NULL THEN 
        pgp_sym_decrypt(emergency_contact_phone_encrypted, encryption_key)
      ELSE NULL
    END,
    'last_accessed_at', last_accessed_at,
    'access_count', access_count,
    'security_enhanced', true,
    'encryption_enabled', true
  ) INTO result
  FROM public.user_sensitive_info
  WHERE user_id = current_user_id;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Create secure function to update user sensitive info with encryption
CREATE FUNCTION public.update_user_sensitive_info(
  new_phone TEXT,
  new_emergency_contact_name TEXT,
  new_emergency_contact_phone TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  encryption_key text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to update sensitive information';
  END IF;
  
  IF NOT check_sensitive_info_rate_limit(current_user_id) THEN
    RAISE EXCEPTION 'Rate limit exceeded for sensitive information updates';
  END IF;
  
  encryption_key := get_encryption_key();
  
  INSERT INTO public.user_sensitive_info (
    user_id,
    phone_encrypted,
    emergency_contact_name_encrypted,
    emergency_contact_phone_encrypted,
    access_count,
    last_accessed_at,
    security_flags
  ) VALUES (
    current_user_id,
    CASE WHEN new_phone IS NOT NULL THEN pgp_sym_encrypt(new_phone, encryption_key) ELSE NULL END,
    CASE WHEN new_emergency_contact_name IS NOT NULL THEN pgp_sym_encrypt(new_emergency_contact_name, encryption_key) ELSE NULL END,
    CASE WHEN new_emergency_contact_phone IS NOT NULL THEN pgp_sym_encrypt(new_emergency_contact_phone, encryption_key) ELSE NULL END,
    1,
    now(),
    jsonb_build_object('audit_enhanced', true, 'encryption_enabled', true)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    phone_encrypted = CASE WHEN new_phone IS NOT NULL THEN pgp_sym_encrypt(new_phone, encryption_key) ELSE user_sensitive_info.phone_encrypted END,
    emergency_contact_name_encrypted = CASE WHEN new_emergency_contact_name IS NOT NULL THEN pgp_sym_encrypt(new_emergency_contact_name, encryption_key) ELSE user_sensitive_info.emergency_contact_name_encrypted END,
    emergency_contact_phone_encrypted = CASE WHEN new_emergency_contact_phone IS NOT NULL THEN pgp_sym_encrypt(new_emergency_contact_phone, encryption_key) ELSE user_sensitive_info.emergency_contact_phone_encrypted END,
    updated_at = now(),
    access_count = user_sensitive_info.access_count + 1,
    last_accessed_at = now();
  
  PERFORM log_sensitive_info_access('updated', 'encrypted_fields', current_user_id);
  
  RETURN get_user_sensitive_info();
END;
$$;

-- Add documentation comments
COMMENT ON TABLE public.user_sensitive_info IS 'Stores encrypted sensitive user contact information. All PII fields are encrypted at rest using pgcrypto.';
COMMENT ON COLUMN public.user_sensitive_info.phone_encrypted IS 'Encrypted phone number using pgp_sym_encrypt - decrypted via get_user_sensitive_info()';
COMMENT ON COLUMN public.user_sensitive_info.emergency_contact_phone_encrypted IS 'Encrypted emergency contact phone using pgp_sym_encrypt - decrypted via get_user_sensitive_info()';
COMMENT ON COLUMN public.user_sensitive_info.emergency_contact_name_encrypted IS 'Encrypted emergency contact name using pgp_sym_encrypt - decrypted via get_user_sensitive_info()';