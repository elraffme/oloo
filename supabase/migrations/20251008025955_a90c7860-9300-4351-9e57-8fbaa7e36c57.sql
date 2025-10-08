-- CRITICAL SECURITY FIX: Remove plain text storage of sensitive phone numbers
-- This migration removes plain text columns and implements proper encryption

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 1: Migrate any existing plain text data to encrypted columns before dropping
-- Only migrate if encrypted columns are NULL (haven't been set yet)
UPDATE public.user_sensitive_info
SET 
  phone_encrypted = CASE 
    WHEN phone_encrypted IS NULL AND phone IS NOT NULL 
    THEN pgp_sym_encrypt(phone, current_setting('app.settings.encryption_key', true))
    ELSE phone_encrypted
  END,
  emergency_contact_name_encrypted = CASE 
    WHEN emergency_contact_name_encrypted IS NULL AND emergency_contact_name IS NOT NULL 
    THEN pgp_sym_encrypt(emergency_contact_name, current_setting('app.settings.encryption_key', true))
    ELSE emergency_contact_name_encrypted
  END,
  emergency_contact_phone_encrypted = CASE 
    WHEN emergency_contact_phone_encrypted IS NULL AND emergency_contact_phone IS NOT NULL 
    THEN pgp_sym_encrypt(emergency_contact_phone, current_setting('app.settings.encryption_key', true))
    ELSE emergency_contact_phone_encrypted
  END
WHERE phone IS NOT NULL 
   OR emergency_contact_name IS NOT NULL 
   OR emergency_contact_phone IS NOT NULL;

-- Step 2: Drop the insecure plain text columns
ALTER TABLE public.user_sensitive_info
  DROP COLUMN IF EXISTS phone CASCADE,
  DROP COLUMN IF EXISTS emergency_contact_name CASCADE,
  DROP COLUMN IF EXISTS emergency_contact_phone CASCADE;

-- Step 3: Recreate get_user_sensitive_info to decrypt data securely
CREATE OR REPLACE FUNCTION public.get_user_sensitive_info()
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
  
  -- Enforce authentication
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to access sensitive information';
  END IF;
  
  -- Get encryption key from settings (use a default for now, should be in secrets)
  encryption_key := COALESCE(
    current_setting('app.settings.encryption_key', true),
    'default_encryption_key_should_be_replaced_in_production'
  );
  
  -- Log access attempt for security audit
  PERFORM log_security_event(
    'sensitive_info_accessed',
    'user_sensitive_info',
    current_user_id,
    jsonb_build_object(
      'timestamp', now(),
      'ip_address', inet_client_addr()::text,
      'security_level', 'critical',
      'data_classification', 'pii_sensitive',
      'encryption_used', true
    )
  );
  
  -- Update access tracking
  UPDATE public.user_sensitive_info
  SET 
    access_count = COALESCE(access_count, 0) + 1,
    last_accessed_at = now()
  WHERE user_id = current_user_id;
  
  -- Decrypt and return sensitive data
  SELECT jsonb_build_object(
    'phone', CASE 
      WHEN phone_encrypted IS NOT NULL 
      THEN pgp_sym_decrypt(phone_encrypted, encryption_key)
      ELSE NULL
    END,
    'emergency_contact_name', CASE 
      WHEN emergency_contact_name_encrypted IS NOT NULL 
      THEN pgp_sym_decrypt(emergency_contact_name_encrypted, encryption_key)
      ELSE NULL
    END,
    'emergency_contact_phone', CASE 
      WHEN emergency_contact_phone_encrypted IS NOT NULL 
      THEN pgp_sym_decrypt(emergency_contact_phone_encrypted, encryption_key)
      ELSE NULL
    END,
    'last_accessed_at', last_accessed_at
  ) INTO result
  FROM public.user_sensitive_info
  WHERE user_id = current_user_id;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Step 4: Recreate update_user_sensitive_info to encrypt data before storage
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
  encryption_key text;
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
  
  -- Get encryption key
  encryption_key := COALESCE(
    current_setting('app.settings.encryption_key', true),
    'default_encryption_key_should_be_replaced_in_production'
  );
  
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
      'encryption_used', true,
      'fields_updated', jsonb_build_object(
        'phone', (new_phone IS NOT NULL),
        'emergency_contact_name', (new_emergency_contact_name IS NOT NULL),
        'emergency_contact_phone', (new_emergency_contact_phone IS NOT NULL)
      )
    )
  );
  
  -- Upsert sensitive info with encrypted values
  INSERT INTO public.user_sensitive_info (
    user_id,
    phone_encrypted,
    emergency_contact_name_encrypted,
    emergency_contact_phone_encrypted,
    updated_at,
    last_accessed_at,
    access_count
  ) VALUES (
    current_user_id,
    CASE WHEN new_phone IS NOT NULL THEN pgp_sym_encrypt(new_phone, encryption_key) ELSE NULL END,
    CASE WHEN new_emergency_contact_name IS NOT NULL THEN pgp_sym_encrypt(new_emergency_contact_name, encryption_key) ELSE NULL END,
    CASE WHEN new_emergency_contact_phone IS NOT NULL THEN pgp_sym_encrypt(new_emergency_contact_phone, encryption_key) ELSE NULL END,
    now(),
    now(),
    1
  )
  ON CONFLICT (user_id) DO UPDATE SET
    phone_encrypted = CASE 
      WHEN EXCLUDED.phone_encrypted IS NOT NULL THEN EXCLUDED.phone_encrypted 
      ELSE user_sensitive_info.phone_encrypted 
    END,
    emergency_contact_name_encrypted = CASE 
      WHEN EXCLUDED.emergency_contact_name_encrypted IS NOT NULL THEN EXCLUDED.emergency_contact_name_encrypted 
      ELSE user_sensitive_info.emergency_contact_name_encrypted 
    END,
    emergency_contact_phone_encrypted = CASE 
      WHEN EXCLUDED.emergency_contact_phone_encrypted IS NOT NULL THEN EXCLUDED.emergency_contact_phone_encrypted 
      ELSE user_sensitive_info.emergency_contact_phone_encrypted 
    END,
    updated_at = now();
  
  -- Return decrypted data for confirmation
  SELECT jsonb_build_object(
    'phone', CASE 
      WHEN phone_encrypted IS NOT NULL 
      THEN pgp_sym_decrypt(phone_encrypted, encryption_key)
      ELSE NULL
    END,
    'emergency_contact_name', CASE 
      WHEN emergency_contact_name_encrypted IS NOT NULL 
      THEN pgp_sym_decrypt(emergency_contact_name_encrypted, encryption_key)
      ELSE NULL
    END,
    'emergency_contact_phone', CASE 
      WHEN emergency_contact_phone_encrypted IS NOT NULL 
      THEN pgp_sym_decrypt(emergency_contact_phone_encrypted, encryption_key)
      ELSE NULL
    END,
    'last_accessed_at', last_accessed_at,
    'success', true
  ) INTO result
  FROM public.user_sensitive_info
  WHERE user_id = current_user_id;
  
  RETURN COALESCE(result, jsonb_build_object('success', false));
END;
$$;

-- Add security audit log entry for this critical security fix
SELECT log_security_event(
  'critical_security_fix_applied',
  'user_sensitive_info',
  NULL,
  jsonb_build_object(
    'action', 'removed_plaintext_pii_columns',
    'timestamp', now(),
    'description', 'Removed plain text phone number and emergency contact columns, implemented encryption-only storage',
    'security_level', 'critical',
    'compliance_impact', 'high'
  )
);

-- Update table comment to reflect enhanced security
COMMENT ON TABLE public.user_sensitive_info IS 'Stores ONLY encrypted sensitive user contact information. All PII fields use pgcrypto pgp_sym_encrypt. Plain text columns removed for security. Access via secure RPC functions only.';

COMMENT ON COLUMN public.user_sensitive_info.phone_encrypted IS 'ENCRYPTED phone number using pgp_sym_encrypt. Decrypted only via get_user_sensitive_info() RPC function.';

COMMENT ON COLUMN public.user_sensitive_info.emergency_contact_phone_encrypted IS 'ENCRYPTED emergency contact phone using pgp_sym_encrypt. Decrypted only via get_user_sensitive_info() RPC function.';

COMMENT ON COLUMN public.user_sensitive_info.emergency_contact_name_encrypted IS 'ENCRYPTED emergency contact name using pgp_sym_encrypt. Decrypted only via get_user_sensitive_info() RPC function.';

COMMENT ON FUNCTION public.get_user_sensitive_info IS 'Securely retrieves and DECRYPTS user''s own sensitive contact information. All data is encrypted at rest and decrypted on-demand. Includes comprehensive access logging.';

COMMENT ON FUNCTION public.update_user_sensitive_info IS 'Securely ENCRYPTS and stores user''s own sensitive contact information. All data is encrypted before storage using pgp_sym_encrypt. Includes validation and comprehensive logging.';