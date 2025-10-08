-- Create separate table for sensitive user information
CREATE TABLE IF NOT EXISTS public.user_sensitive_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on sensitive info table
ALTER TABLE public.user_sensitive_info ENABLE ROW LEVEL SECURITY;

-- Create highly restrictive RLS policies for sensitive info
CREATE POLICY "Users can only view their own sensitive info with audit"
ON public.user_sensitive_info
FOR SELECT
USING (
  auth.uid() = user_id AND
  -- Log access to sensitive information
  (SELECT log_security_event('sensitive_info_accessed', 'user_sensitive_info', id, jsonb_build_object('accessed_fields', array['phone']))) IS NULL
);

CREATE POLICY "Users can only insert their own sensitive info"
ON public.user_sensitive_info
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  -- Log creation of sensitive information
  (SELECT log_security_event('sensitive_info_created', 'user_sensitive_info', NULL, jsonb_build_object('user_id', user_id))) IS NULL
);

CREATE POLICY "Users can only update their own sensitive info with audit"
ON public.user_sensitive_info
FOR UPDATE
USING (
  auth.uid() = user_id AND
  -- Log updates to sensitive information
  (SELECT log_security_event('sensitive_info_updated', 'user_sensitive_info', id, jsonb_build_object('updated_by', auth.uid()))) IS NULL
)
WITH CHECK (auth.uid() = user_id);

-- Migrate existing phone data from profiles to sensitive info table
INSERT INTO public.user_sensitive_info (user_id, phone)
SELECT user_id, phone 
FROM public.profiles 
WHERE phone IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET 
  phone = EXCLUDED.phone,
  updated_at = now();

-- Remove phone column from profiles table for security
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;

-- Create secure function to get user's own sensitive info
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
  
  IF current_user_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  
  -- Log access attempt
  PERFORM log_security_event('sensitive_info_function_called', 'user_sensitive_info', NULL, 
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
$$;

-- Create function to safely update sensitive info
CREATE OR REPLACE FUNCTION public.update_user_sensitive_info(
  new_phone TEXT DEFAULT NULL,
  new_emergency_contact_name TEXT DEFAULT NULL,
  new_emergency_contact_phone TEXT DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  changes_made jsonb := '{}'::jsonb;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
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
$$;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_sensitive_info_updated_at
  BEFORE UPDATE ON public.user_sensitive_info
  FOR EACH ROW
  EXECUTE FUNCTION public.update_at_column();