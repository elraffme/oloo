-- Fix security linter issues: Set proper search_path for security definer functions

-- Fix encrypt_payment_field function search path
CREATE OR REPLACE FUNCTION public.encrypt_payment_field(plaintext text, field_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  encryption_key text;
  encrypted_data text;
BEGIN
  -- Use a combination of user session and field type for encryption context
  encryption_key := encode(digest(
    COALESCE(auth.uid()::text, 'system') || ':' || field_type || ':payment_encryption',
    'sha256'
  ), 'hex');
  
  -- Simple encryption using built-in functions (in production, use proper encryption)
  encrypted_data := encode(
    digest(plaintext || ':' || encryption_key, 'sha256'),
    'base64'
  );
  
  RETURN encrypted_data;
END;
$function$;

-- Fix log_payment_security_event function search path  
CREATE OR REPLACE FUNCTION public.log_payment_security_event(
  p_operation text,
  p_payment_intent_id text,
  p_user_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Enhanced payment audit logging with security classification
  INSERT INTO public.payment_audit_log (
    operation_type,
    payment_intent_id,
    user_id,
    amount_cents,
    old_status,
    new_status,
    metadata,
    ip_address,
    user_agent
  ) VALUES (
    p_operation,
    p_payment_intent_id,
    COALESCE(p_user_id, auth.uid()),
    COALESCE((p_details->>'amount_cents')::integer, 0),
    p_details->>'old_status',
    p_details->>'new_status',
    p_details || jsonb_build_object(
      'security_enhanced', true,
      'encryption_enabled', true,
      'access_method', 'secure_function',
      'timestamp', now(),
      'classification', 'financial_sensitive'
    ),
    inet_client_addr(),
    p_details->>'user_agent'
  );

  -- Also log to main security audit log
  PERFORM log_security_event(
    'payment_' || p_operation,
    'payment_intent',
    p_payment_intent_id::uuid,
    jsonb_build_object(
      'security_level', 'critical',
      'data_classification', 'financial_pii',
      'operation', p_operation,
      'enhanced_security', true
    )
  );
END;
$function$;

-- Fix validate_payment_access function search path
CREATE OR REPLACE FUNCTION public.validate_payment_access(
  p_payment_intent_id text,
  p_operation_type text DEFAULT 'read'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_user_id uuid;
  current_user_id uuid;
  is_restricted boolean := false;
BEGIN
  current_user_id := auth.uid();
  
  -- Strict authentication requirement for all payment operations
  IF current_user_id IS NULL THEN
    PERFORM log_payment_security_event(
      'unauthorized_access_attempt',
      p_payment_intent_id,
      NULL,
      jsonb_build_object(
        'operation', p_operation_type,
        'error', 'no_authentication',
        'security_violation', true
      )
    );
    RETURN false;
  END IF;

  -- Get payment owner and check restrictions
  SELECT user_id, COALESCE(access_restricted_until > now(), false)
  INTO target_user_id, is_restricted
  FROM public.payment_intents 
  WHERE id = p_payment_intent_id;

  -- Check if payment exists and user owns it
  IF target_user_id IS NULL THEN
    PERFORM log_payment_security_event(
      'payment_not_found',
      p_payment_intent_id,
      current_user_id,
      jsonb_build_object('operation', p_operation_type)
    );
    RETURN false;
  END IF;

  -- Verify ownership
  IF target_user_id != current_user_id THEN
    PERFORM log_payment_security_event(
      'unauthorized_payment_access',
      p_payment_intent_id,
      current_user_id,
      jsonb_build_object(
        'operation', p_operation_type,
        'target_user', target_user_id,
        'security_violation', true
      )
    );
    RETURN false;
  END IF;

  -- Check for temporary restrictions
  IF is_restricted AND p_operation_type IN ('update', 'delete') THEN
    PERFORM log_payment_security_event(
      'restricted_access_blocked',
      p_payment_intent_id,
      current_user_id,
      jsonb_build_object('operation', p_operation_type)
    );
    RETURN false;
  END IF;

  -- Log successful access validation
  PERFORM log_payment_security_event(
    'access_validated',
    p_payment_intent_id,
    current_user_id,
    jsonb_build_object('operation', p_operation_type)
  );

  RETURN true;
END;
$function$;

-- Fix protect_payment_encryption function search path
CREATE OR REPLACE FUNCTION public.protect_payment_encryption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only check if encrypted fields exist
  IF TG_OP = 'UPDATE' AND (
    (OLD.encrypted_customer_id IS DISTINCT FROM NEW.encrypted_customer_id) OR
    (OLD.encrypted_amount_hash IS DISTINCT FROM NEW.encrypted_amount_hash)
  ) THEN
    PERFORM log_payment_security_event(
      'encryption_tampering_attempt',
      NEW.id,
      auth.uid(),
      jsonb_build_object(
        'operation', 'direct_encrypted_field_update',
        'security_violation', true
      )
    );
    RAISE EXCEPTION 'Direct modification of encrypted payment fields is not allowed';
  END IF;

  RETURN NEW;
END;
$function$;