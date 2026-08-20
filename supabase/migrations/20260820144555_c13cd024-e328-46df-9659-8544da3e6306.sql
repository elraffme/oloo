CREATE OR REPLACE FUNCTION public.claim_founding_credits(p_claim_id uuid, p_main_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim public.founding_credit_claims;
  v_amount constant integer := 500;
  v_new_balance integer;
  v_tx_id uuid;
  v_tx public.currency_transactions;
BEGIN
  IF p_main_user_id IS NULL THEN
    RETURN jsonb_build_object('status','invalid_user');
  END IF;

  SELECT * INTO v_claim FROM public.founding_credit_claims
    WHERE id = p_claim_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','not_found');
  END IF;

  -- Genuine idempotency: a real ledger row for this claim is the only proof
  -- that the 500 credits were ever awarded. Historic rows exist with
  -- status='claimed', main_user_id NULL and a transaction_id that points at a
  -- transaction that was never written; those must be repaired, not trusted.
  SELECT * INTO v_tx FROM public.currency_transactions
    WHERE reference_id = v_claim.id AND reason = 'founding_credit'
    ORDER BY created_at ASC LIMIT 1;

  IF FOUND THEN
    SELECT coin_balance INTO v_new_balance FROM public.currency_balances WHERE user_id = v_tx.user_id;
    -- Repair a claim row that lost its link to the awarded user.
    UPDATE public.founding_credit_claims
      SET status = 'claimed',
          main_user_id = COALESCE(main_user_id, v_tx.user_id),
          credits_awarded = v_tx.amount,
          transaction_id = v_tx.id,
          claimed_at = COALESCE(claimed_at, v_tx.created_at),
          claim_token_hash = NULL,
          token_expires_at = NULL
      WHERE id = v_claim.id;
    RETURN jsonb_build_object(
      'status','already_claimed',
      'main_user_id', v_tx.user_id,
      'credits_awarded', v_tx.amount,
      'balance', COALESCE(v_new_balance, 0),
      'transaction_id', v_tx.id
    );
  END IF;

  IF v_claim.status = 'revoked' THEN
    RETURN jsonb_build_object('status','revoked');
  END IF;

  INSERT INTO public.currency_balances (user_id, coin_balance, updated_at)
  VALUES (p_main_user_id, v_amount, now())
  ON CONFLICT (user_id) DO UPDATE
    SET coin_balance = public.currency_balances.coin_balance + v_amount,
        updated_at = now()
  RETURNING coin_balance INTO v_new_balance;

  INSERT INTO public.currency_transactions (
    user_id, currency_type, transaction_type, amount, balance_after, reference_id, reason, metadata
  ) VALUES (
    p_main_user_id, 'coins', 'reward', v_amount, v_new_balance, v_claim.id, 'founding_credit',
    jsonb_build_object('source', v_claim.source, 'join_user_id', v_claim.join_user_id)
  ) RETURNING id INTO v_tx_id;

  UPDATE public.founding_credit_claims
    SET status = 'claimed',
        main_user_id = p_main_user_id,
        credits_awarded = v_amount,
        transaction_id = v_tx_id,
        claimed_at = now(),
        claim_token_hash = NULL,
        token_expires_at = NULL
  WHERE id = v_claim.id;

  RETURN jsonb_build_object(
    'status','awarded',
    'main_user_id', p_main_user_id,
    'credits_awarded', v_amount,
    'balance', v_new_balance,
    'transaction_id', v_tx_id
  );
END;
$$;