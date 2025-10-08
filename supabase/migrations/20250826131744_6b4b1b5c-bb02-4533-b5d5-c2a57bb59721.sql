-- CRITICAL SECURITY FIX: Secure payment_intents table access
-- Remove overly permissive service role policy and implement secure payment processing

-- Drop the existing overly permissive service role policy
DROP POLICY IF EXISTS "Service role can manage payment intents" ON public.payment_intents;

-- Create secure payment processing function that validates and logs access
CREATE OR REPLACE FUNCTION public.secure_payment_operation(
  operation_type text,
  payment_intent_id text DEFAULT NULL,
  payment_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  current_user_id uuid;
BEGIN
  -- Get current user ID (will be null for service operations)
  current_user_id := auth.uid();
  
  -- Log all payment operations for security audit
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address
  ) VALUES (
    current_user_id,
    'payment_operation',
    'payment_intent',
    payment_intent_id::uuid,
    jsonb_build_object(
      'operation_type', operation_type,
      'timestamp', now(),
      'payment_data_keys', CASE WHEN payment_data != '{}'::jsonb THEN array(SELECT jsonb_object_keys(payment_data)) ELSE NULL END
    ),
    inet_client_addr()
  );
  
  -- Validate operation types
  IF operation_type NOT IN ('create', 'update_status', 'retrieve', 'webhook_update') THEN
    RAISE EXCEPTION 'Invalid payment operation type: %', operation_type;
  END IF;
  
  -- Execute operation based on type
  CASE operation_type
    WHEN 'create' THEN
      -- Only allow creation if user_id matches current user or is service operation
      IF current_user_id IS NOT NULL AND (payment_data->>'user_id')::uuid != current_user_id THEN
        RAISE EXCEPTION 'Cannot create payment intent for different user';
      END IF;
      
      INSERT INTO public.payment_intents (
        id,
        user_id,
        customer_id,
        amount_cents,
        currency,
        tier,
        status
      ) VALUES (
        payment_intent_id,
        (payment_data->>'user_id')::uuid,
        payment_data->>'customer_id',
        (payment_data->>'amount_cents')::integer,
        COALESCE(payment_data->>'currency', 'usd'),
        payment_data->>'tier',
        COALESCE(payment_data->>'status', 'requires_payment_method')
      )
      RETURNING to_jsonb(payment_intents.*) INTO result;
      
    WHEN 'update_status' THEN
      -- Only allow status updates for webhook operations or own payments
      UPDATE public.payment_intents 
      SET 
        status = payment_data->>'status',
        updated_at = now()
      WHERE id = payment_intent_id
        AND (current_user_id IS NULL OR user_id = current_user_id)
      RETURNING to_jsonb(payment_intents.*) INTO result;
      
    WHEN 'retrieve' THEN
      -- Only allow retrieval of own payments or service operations
      SELECT to_jsonb(payment_intents.*) INTO result
      FROM public.payment_intents
      WHERE id = payment_intent_id
        AND (current_user_id IS NULL OR user_id = current_user_id);
        
    WHEN 'webhook_update' THEN
      -- Only allow webhook updates from service operations (no current user)
      IF current_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'Webhook updates only allowed from service operations';
      END IF;
      
      UPDATE public.payment_intents 
      SET 
        status = COALESCE(payment_data->>'status', status),
        updated_at = now()
      WHERE id = payment_intent_id
      RETURNING to_jsonb(payment_intents.*) INTO result;
  END CASE;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$function$;

-- Create new restrictive policies for payment_intents
CREATE POLICY "Users can view own payment intents only"
ON public.payment_intents
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Payments can only be created via secure function"
ON public.payment_intents
FOR INSERT
TO authenticated
WITH CHECK (false); -- Force all inserts through secure function

CREATE POLICY "Payments can only be updated via secure function" 
ON public.payment_intents
FOR UPDATE
TO authenticated
USING (false); -- Force all updates through secure function

-- Create payment audit log table for enhanced security monitoring
CREATE TABLE IF NOT EXISTS public.payment_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_intent_id text,
  user_id uuid,
  operation_type text NOT NULL,
  old_status text,
  new_status text,
  amount_cents integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

-- Only service operations and users can view their own payment audit logs
CREATE POLICY "Users can view own payment audit logs"
ON public.payment_audit_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service can insert payment audit logs"
ON public.payment_audit_log
FOR INSERT
WITH CHECK (true);

-- Create function to validate payment amount limits (prevent fraud)
CREATE OR REPLACE FUNCTION public.validate_payment_amount(amount_cents integer, tier text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Define maximum amounts per tier (in cents)
  CASE tier
    WHEN 'silver' THEN
      RETURN amount_cents <= 999; -- $9.99 max
    WHEN 'gold' THEN
      RETURN amount_cents <= 1999; -- $19.99 max  
    WHEN 'platinum' THEN
      RETURN amount_cents <= 2999; -- $29.99 max
    ELSE
      RETURN amount_cents <= 499; -- $4.99 max for unknown tiers
  END CASE;
END;
$function$;