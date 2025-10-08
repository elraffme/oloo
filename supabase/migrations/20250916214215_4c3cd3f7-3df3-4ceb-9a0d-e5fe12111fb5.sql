-- Fix security vulnerability in user_sensitive_info table RLS policies
-- Remove complex audit logging from RLS policies and simplify them

-- Drop existing policies that have complex audit logging conditions
DROP POLICY IF EXISTS "Users can only insert their own sensitive info" ON public.user_sensitive_info;
DROP POLICY IF EXISTS "Users can only update their own sensitive info with audit" ON public.user_sensitive_info;
DROP POLICY IF EXISTS "Users can only view their own sensitive info with audit" ON public.user_sensitive_info;

-- Create simplified, secure RLS policies without audit logging conditions
-- Audit logging will be handled by the secure functions instead

CREATE POLICY "secure_insert_own_sensitive_info" 
ON public.user_sensitive_info 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

CREATE POLICY "secure_update_own_sensitive_info" 
ON public.user_sensitive_info 
FOR UPDATE 
USING (auth.uid() = user_id AND auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

CREATE POLICY "secure_select_own_sensitive_info" 
ON public.user_sensitive_info 
FOR SELECT 
USING (auth.uid() = user_id AND auth.uid() IS NOT NULL);

-- Prevent any DELETE operations on sensitive info for data integrity
CREATE POLICY "no_delete_sensitive_info" 
ON public.user_sensitive_info 
FOR DELETE 
USING (false);

-- Update the existing secure functions to ensure they handle audit logging properly
-- and provide the only safe way to access sensitive information

CREATE OR REPLACE FUNCTION public.get_user_sensitive_info()
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
  
  -- Strict authentication check
  IF current_user_id IS NULL THEN
    -- Log unauthorized access attempt
    PERFORM log_security_event('unauthorized_sensitive_info_access', 'user_sensitive_info', NULL, 
      jsonb_build_object('error', 'no_auth', 'timestamp', now()));
    RETURN '{}'::jsonb;
  END IF;
  
  -- Log legitimate access attempt
  PERFORM log_security_event('sensitive_info_accessed', 'user_sensitive_info', NULL, 
    jsonb_build_object('user_id', current_user_id, 'timestamp', now()));
  
  -- Update last accessed timestamp
  UPDATE public.user_sensitive_info 
  SET last_accessed_at = now() 
  WHERE user_id = current_user_id;
  
  -- Return only user's own sensitive information
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
$function$;

CREATE OR REPLACE FUNCTION public.update_user_sensitive_info(
  new_phone text DEFAULT NULL::text, 
  new_emergency_contact_name text DEFAULT NULL::text, 
  new_emergency_contact_phone text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  changes_made jsonb := '{}'::jsonb;
BEGIN
  current_user_id := auth.uid();
  
  -- Strict authentication check
  IF current_user_id IS NULL THEN
    PERFORM log_security_event('unauthorized_sensitive_info_update', 'user_sensitive_info', NULL, 
      jsonb_build_object('error', 'no_auth', 'timestamp', now()));
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Build changes object for audit log
  IF new_phone IS NOT NULL THEN
    changes_made := changes_made || jsonb_build_object('phone_updated', true);
  END IF;
  IF new_emergency_contact_name IS NOT NULL THEN
    changes_made := changes_made || jsonb_build_object('emergency_contact_name_updated', true);
  END IF;
  IF new_emergency_contact_phone IS NOT NULL THEN
    changes_made := changes_made || jsonb_build_object('emergency_contact_phone_updated', true);
  END IF;
  
  -- Log the update attempt
  PERFORM log_security_event('sensitive_info_update_attempt', 'user_sensitive_info', NULL, 
    jsonb_build_object('user_id', current_user_id, 'changes', changes_made));
  
  -- Perform the update
  INSERT INTO public.user_sensitive_info (user_id, phone, emergency_contact_name, emergency_contact_phone)
  VALUES (current_user_id, new_phone, new_emergency_contact_name, new_emergency_contact_phone)
  ON CONFLICT (user_id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, user_sensitive_info.phone),
    emergency_contact_name = COALESCE(EXCLUDED.emergency_contact_name, user_sensitive_info.emergency_contact_name),
    emergency_contact_phone = COALESCE(EXCLUDED.emergency_contact_phone, user_sensitive_info.emergency_contact_phone),
    updated_at = now();
  
  -- Log successful update
  PERFORM log_security_event('sensitive_info_updated_successfully', 'user_sensitive_info', NULL, 
    jsonb_build_object('user_id', current_user_id, 'changes', changes_made));
  
  RETURN TRUE;
END;
$function$;