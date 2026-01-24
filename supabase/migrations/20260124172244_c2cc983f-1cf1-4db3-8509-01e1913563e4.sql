-- Create withdrawals table for host token-to-cash conversions
CREATE TABLE public.withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_amount INTEGER NOT NULL CHECK (token_amount > 0),
  cash_amount_cents INTEGER NOT NULL CHECK (cash_amount_cents > 0),
  conversion_rate NUMERIC(10,4) NOT NULL DEFAULT 0.01, -- $0.01 per token
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  payment_method TEXT,
  payment_details JSONB DEFAULT '{}'::jsonb,
  admin_notes TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Users can view their own withdrawals
CREATE POLICY "Users can view own withdrawals"
ON public.withdrawals
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create withdrawal requests
CREATE POLICY "Users can create withdrawal requests"
ON public.withdrawals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all withdrawals
CREATE POLICY "Admins can view all withdrawals"
ON public.withdrawals
FOR SELECT
USING (is_admin());

-- Admins can update withdrawals (mark as completed/rejected)
CREATE POLICY "Admins can update withdrawals"
ON public.withdrawals
FOR UPDATE
USING (is_admin());

-- Create function to process withdrawal (deduct tokens)
CREATE OR REPLACE FUNCTION process_withdrawal_request(
  p_token_amount INTEGER,
  p_conversion_rate NUMERIC DEFAULT 0.01
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_balance INTEGER;
  v_cash_amount_cents INTEGER;
  v_withdrawal_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Get current token balance
  SELECT coin_balance INTO v_current_balance
  FROM currency_balances
  WHERE user_id = v_user_id;
  
  IF v_current_balance IS NULL OR v_current_balance < p_token_amount THEN
    RAISE EXCEPTION 'Insufficient token balance';
  END IF;
  
  -- Calculate cash amount (tokens * rate * 100 for cents)
  v_cash_amount_cents := (p_token_amount * p_conversion_rate * 100)::INTEGER;
  
  IF v_cash_amount_cents < 100 THEN -- Minimum $1 withdrawal
    RAISE EXCEPTION 'Minimum withdrawal is $1.00';
  END IF;
  
  -- Deduct tokens from balance
  UPDATE currency_balances
  SET coin_balance = coin_balance - p_token_amount,
      updated_at = now()
  WHERE user_id = v_user_id;
  
  -- Record transaction
  INSERT INTO currency_transactions (
    user_id, currency_type, transaction_type, amount, balance_after, reason
  ) VALUES (
    v_user_id, 'coins', 'withdrawal', -p_token_amount, 
    v_current_balance - p_token_amount, 'Withdrawal request'
  );
  
  -- Create withdrawal record
  INSERT INTO withdrawals (
    user_id, token_amount, cash_amount_cents, conversion_rate
  ) VALUES (
    v_user_id, p_token_amount, v_cash_amount_cents, p_conversion_rate
  )
  RETURNING id INTO v_withdrawal_id;
  
  RETURN v_withdrawal_id;
END;
$$;

-- Create function for admin to complete withdrawal
CREATE OR REPLACE FUNCTION complete_withdrawal(
  p_withdrawal_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  
  -- Verify admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  -- Update withdrawal status
  UPDATE withdrawals
  SET status = 'completed',
      processed_by = v_admin_id,
      processed_at = now(),
      admin_notes = p_admin_notes,
      updated_at = now()
  WHERE id = p_withdrawal_id
    AND status = 'pending';
  
  RETURN FOUND;
END;
$$;

-- Create function for admin to reject withdrawal (refund tokens)
CREATE OR REPLACE FUNCTION reject_withdrawal(
  p_withdrawal_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_user_id UUID;
  v_token_amount INTEGER;
  v_current_balance INTEGER;
BEGIN
  v_admin_id := auth.uid();
  
  -- Verify admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  -- Get withdrawal details
  SELECT user_id, token_amount INTO v_user_id, v_token_amount
  FROM withdrawals
  WHERE id = p_withdrawal_id AND status = 'pending';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found or already processed';
  END IF;
  
  -- Refund tokens
  UPDATE currency_balances
  SET coin_balance = coin_balance + v_token_amount,
      updated_at = now()
  WHERE user_id = v_user_id
  RETURNING coin_balance INTO v_current_balance;
  
  -- Record refund transaction
  INSERT INTO currency_transactions (
    user_id, currency_type, transaction_type, amount, balance_after, reason
  ) VALUES (
    v_user_id, 'coins', 'refund', v_token_amount, 
    v_current_balance, 'Withdrawal rejected - tokens refunded'
  );
  
  -- Update withdrawal status
  UPDATE withdrawals
  SET status = 'rejected',
      processed_by = v_admin_id,
      processed_at = now(),
      admin_notes = p_admin_notes,
      updated_at = now()
  WHERE id = p_withdrawal_id;
  
  RETURN TRUE;
END;
$$;