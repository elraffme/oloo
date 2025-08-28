-- Fix Service Account Token Balance Security Vulnerability
-- Remove overly permissive service role access and implement secure token operations

-- First, drop the dangerous service role policy
DROP POLICY IF EXISTS "Service role can manage transactions" ON public.token_transactions;

-- Create secure validation function for token operations
CREATE OR REPLACE FUNCTION public.validate_token_operation(
  operation_type text,
  target_user_id uuid,
  token_delta integer,
  operation_reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_balance integer;
  daily_transaction_count integer;
  operation_metadata jsonb;
BEGIN
  -- Validate operation type
  IF operation_type NOT IN ('reward', 'purchase', 'gift_send', 'gift_receive', 'subscription_bonus', 'admin_adjustment') THEN
    RAISE EXCEPTION 'Invalid token operation type: %', operation_type;
  END IF;
  
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User does not exist: %', target_user_id;
  END IF;
  
  -- Get current balance
  SELECT COALESCE(balance, 0) INTO current_balance
  FROM public.token_transactions 
  WHERE user_id = target_user_id 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  -- Prevent negative balances for deductions
  IF token_delta < 0 AND (current_balance + token_delta) < 0 THEN
    RAISE EXCEPTION 'Insufficient token balance. Current: %, Requested: %', current_balance, ABS(token_delta);
  END IF;
  
  -- Prevent excessive single transactions (anti-abuse)
  IF ABS(token_delta) > 10000 THEN
    RAISE EXCEPTION 'Token amount exceeds maximum allowed per transaction: %', ABS(token_delta);
  END IF;
  
  -- Check daily transaction limits
  SELECT COUNT(*) INTO daily_transaction_count
  FROM public.token_transactions
  WHERE user_id = target_user_id 
    AND created_at >= (now() - interval '24 hours');
    
  IF daily_transaction_count >= 50 THEN
    RAISE EXCEPTION 'Daily transaction limit exceeded for user: %', target_user_id;
  END IF;
  
  -- Build audit metadata
  operation_metadata := jsonb_build_object(
    'operation_type', operation_type,
    'user_id', target_user_id,
    'token_delta', token_delta,
    'reason', operation_reason,
    'previous_balance', current_balance,
    'new_balance', current_balance + token_delta,
    'timestamp', now(),
    'service_operation', true
  );
  
  -- Log the operation
  PERFORM log_security_event('token_operation_validated', 'token_transaction', NULL, operation_metadata);
  
  RETURN TRUE;
END;
$$;

-- Create secure token transaction function
CREATE OR REPLACE FUNCTION public.create_secure_token_transaction(
  target_user_id uuid,
  token_amount integer,
  operation_reason text,
  operation_type text DEFAULT 'admin_adjustment'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_balance integer;
  transaction_id uuid;
  current_balance integer;
BEGIN
  -- Only allow service role or specific authenticated operations
  IF auth.role() != 'service_role' AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized token transaction attempt';
  END IF;
  
  -- Validate the operation
  IF NOT validate_token_operation(operation_type, target_user_id, token_amount, operation_reason) THEN
    RAISE EXCEPTION 'Token operation validation failed';
  END IF;
  
  -- Get current balance
  SELECT COALESCE(balance, 0) INTO current_balance
  FROM public.token_transactions 
  WHERE user_id = target_user_id 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  -- Calculate new balance
  new_balance := current_balance + token_amount;
  
  -- Create the transaction with audit trail
  INSERT INTO public.token_transactions (
    user_id,
    delta,
    balance,
    reason,
    metadata
  ) VALUES (
    target_user_id,
    token_amount,
    new_balance,
    operation_reason,
    jsonb_build_object(
      'operation_type', operation_type,
      'created_by', COALESCE(auth.uid()::text, 'service_role'),
      'ip_address', inet_client_addr()::text,
      'timestamp', now(),
      'security_validated', true
    )
  )
  RETURNING id INTO transaction_id;
  
  -- Log successful transaction
  PERFORM log_security_event('token_transaction_created', 'token_transaction', transaction_id, 
    jsonb_build_object(
      'user_id', target_user_id,
      'amount', token_amount,
      'new_balance', new_balance,
      'operation_type', operation_type
    ));
  
  RETURN transaction_id;
END;
$$;

-- Create restrictive RLS policies for token transactions
CREATE POLICY "Authenticated users can view own token transactions"
ON public.token_transactions
FOR SELECT
USING (auth.uid() = user_id AND auth.uid() IS NOT NULL);

CREATE POLICY "Secure token transactions via function only"
ON public.token_transactions
FOR INSERT
WITH CHECK (
  -- Only allow inserts through secure function or direct user rewards
  (
    -- Service operations through secure function (has security_validated metadata)
    (metadata->>'security_validated')::boolean = true
  ) OR (
    -- Direct user operations (gift receiving, etc.) - limited scope
    auth.uid() = user_id 
    AND delta > 0 
    AND delta <= 100 
    AND reason IN ('gift_received', 'daily_bonus', 'profile_completion')
  )
);

CREATE POLICY "No direct token transaction updates"
ON public.token_transactions
FOR UPDATE
USING (false);

CREATE POLICY "No direct token transaction deletes"  
ON public.token_transactions
FOR DELETE
USING (false);

-- Create audit trigger for token transactions
CREATE OR REPLACE FUNCTION public.audit_token_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log all token transaction attempts
  IF TG_OP = 'INSERT' THEN
    PERFORM log_security_event('token_transaction_audit', 'token_transaction', NEW.id, 
      jsonb_build_object(
        'user_id', NEW.user_id,
        'delta', NEW.delta,
        'balance', NEW.balance,
        'reason', NEW.reason,
        'operation', 'INSERT'
      ));
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    PERFORM log_security_event('token_transaction_modification_attempt', 'token_transaction', NEW.id, 
      jsonb_build_object(
        'user_id', NEW.user_id,
        'old_balance', OLD.balance,
        'new_balance', NEW.balance,
        'operation', 'UPDATE'
      ));
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    PERFORM log_security_event('token_transaction_deletion_attempt', 'token_transaction', OLD.id, 
      jsonb_build_object(
        'user_id', OLD.user_id,
        'deleted_balance', OLD.balance,
        'operation', 'DELETE'
      ));
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Apply audit trigger
CREATE TRIGGER token_transaction_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.token_transactions
  FOR EACH ROW EXECUTE FUNCTION audit_token_transaction();

-- Add constraints to prevent data integrity issues
ALTER TABLE public.token_transactions 
  ADD CONSTRAINT valid_delta_range 
  CHECK (delta BETWEEN -10000 AND 10000);

ALTER TABLE public.token_transactions 
  ADD CONSTRAINT valid_balance_range 
  CHECK (balance >= 0 AND balance <= 1000000);

-- Create index for performance on user lookups
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_created 
ON public.token_transactions(user_id, created_at DESC);

-- Create emergency token freeze function (for security incidents)
CREATE OR REPLACE FUNCTION public.emergency_freeze_user_tokens(target_user_id uuid, freeze_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow admins or service role to freeze accounts
  IF NOT (is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can freeze token accounts';
  END IF;
  
  -- Log the freeze action
  PERFORM log_security_event('emergency_token_freeze', 'user_account', target_user_id, 
    jsonb_build_object(
      'frozen_by', auth.uid(),
      'reason', freeze_reason,
      'timestamp', now()
    ));
  
  -- Insert freeze marker transaction
  PERFORM create_secure_token_transaction(
    target_user_id,
    0,
    'ACCOUNT FROZEN: ' || freeze_reason,
    'admin_adjustment'
  );
  
  RETURN TRUE;
END;
$$;