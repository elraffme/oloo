-- Fix security audit log manipulation vulnerability
-- Remove the policy that allows users to insert their own audit events

DROP POLICY IF EXISTS "Authenticated users can log their own events" ON public.security_audit_log;

-- Update the service role policy to be more explicit and secure
DROP POLICY IF EXISTS "Service role only audit log insertions" ON public.security_audit_log;

-- Create a more secure policy that only allows insertions through system functions
-- This will work with SECURITY DEFINER functions like log_security_event
CREATE POLICY "System functions only can insert audit logs"
ON public.security_audit_log
FOR INSERT
WITH CHECK (
  -- Only allow insertions when there's no authenticated user (service operations)
  -- OR when called through a SECURITY DEFINER function (which bypasses RLS)
  auth.uid() IS NULL OR 
  -- This condition will be true for SECURITY DEFINER functions
  current_setting('role') = 'service_role'
);

-- Ensure the log_security_event function can still insert records
-- by updating it to be more explicit about its security context
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action text, 
  p_resource_type text DEFAULT NULL, 
  p_resource_id uuid DEFAULT NULL, 
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Get the current user ID for logging purposes
  target_user_id := auth.uid();
  
  -- Insert the audit log entry with proper security context
  INSERT INTO public.security_audit_log (
    user_id, 
    action, 
    resource_type, 
    resource_id, 
    details,
    ip_address,
    created_at
  ) VALUES (
    target_user_id,
    p_action, 
    p_resource_type, 
    p_resource_id, 
    p_details,
    inet_client_addr(),
    now()
  );
  
  -- Log critical security events to system logs as well
  IF p_action IN ('login_failed', 'password_reset', 'account_locked', 'admin_access') THEN
    RAISE LOG 'SECURITY_EVENT: user_id=%, action=%, details=%', 
      target_user_id, p_action, p_details;
  END IF;
END;
$$;

-- Create a more secure audit logging function for system operations
CREATE OR REPLACE FUNCTION public.log_system_security_event(
  p_action text,
  p_user_id uuid DEFAULT NULL,
  p_resource_type text DEFAULT NULL, 
  p_resource_id uuid DEFAULT NULL, 
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- This function is for system-level operations where we might not have an auth context
  INSERT INTO public.security_audit_log (
    user_id, 
    action, 
    resource_type, 
    resource_id, 
    details,
    ip_address,
    created_at
  ) VALUES (
    p_user_id,
    p_action, 
    p_resource_type, 
    p_resource_id, 
    p_details || jsonb_build_object('system_generated', true),
    inet_client_addr(),
    now()
  );
END;
$$;

-- Add a trigger to prevent direct manipulation of audit logs
CREATE OR REPLACE FUNCTION public.prevent_audit_log_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Prevent updates and deletes on audit logs to maintain integrity
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Audit logs cannot be modified to maintain integrity';
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit logs cannot be deleted to maintain integrity';
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create triggers to prevent tampering
DROP TRIGGER IF EXISTS prevent_audit_log_updates ON public.security_audit_log;
CREATE TRIGGER prevent_audit_log_updates
  BEFORE UPDATE ON public.security_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_tampering();

DROP TRIGGER IF EXISTS prevent_audit_log_deletes ON public.security_audit_log;
CREATE TRIGGER prevent_audit_log_deletes
  BEFORE DELETE ON public.security_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_tampering();

-- Update policies to prevent updates and deletes entirely
DROP POLICY IF EXISTS "Users can view their own security events" ON public.security_audit_log;
DROP POLICY IF EXISTS "Only system admins can view audit logs" ON public.security_audit_log;

-- Create more secure viewing policies
CREATE POLICY "System admins can view all audit logs"
ON public.security_audit_log
FOR SELECT
USING (is_admin());

CREATE POLICY "Users can view only their own audit events"
ON public.security_audit_log
FOR SELECT
USING (
  auth.uid() = user_id 
  AND action NOT IN ('admin_access', 'system_operation', 'security_violation')
);

-- Completely prevent UPDATE and DELETE operations via RLS
CREATE POLICY "No updates allowed on audit logs"
ON public.security_audit_log
FOR UPDATE
USING (false);

CREATE POLICY "No deletes allowed on audit logs"
ON public.security_audit_log
FOR DELETE
USING (false);