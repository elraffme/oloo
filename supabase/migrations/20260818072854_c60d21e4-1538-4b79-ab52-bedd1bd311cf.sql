-- 1. Claims table
CREATE TABLE public.founding_credit_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  join_user_id uuid NOT NULL,
  join_email_normalized text NOT NULL,
  main_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  claim_token_hash text,
  token_expires_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','revoked')),
  credits_awarded integer NOT NULL DEFAULT 0,
  transaction_id uuid,
  source text NOT NULL DEFAULT 'join-oloo',
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX founding_claims_join_user_uniq ON public.founding_credit_claims (join_user_id);
CREATE UNIQUE INDEX founding_claims_idem_uniq ON public.founding_credit_claims (idempotency_key);
CREATE UNIQUE INDEX founding_claims_main_user_uniq ON public.founding_credit_claims (main_user_id) WHERE main_user_id IS NOT NULL;
CREATE UNIQUE INDEX founding_claims_email_uniq ON public.founding_credit_claims (join_email_normalized) WHERE status <> 'revoked';
CREATE INDEX founding_claims_token_idx ON public.founding_credit_claims (claim_token_hash) WHERE claim_token_hash IS NOT NULL;

GRANT ALL ON public.founding_credit_claims TO service_role;
ALTER TABLE public.founding_credit_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages founding claims"
  ON public.founding_credit_claims FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER founding_claims_updated_at
  BEFORE UPDATE ON public.founding_credit_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Replay protection
CREATE TABLE public.integration_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX integration_nonces_uniq ON public.integration_nonces (source, nonce);
CREATE INDEX integration_nonces_created_idx ON public.integration_nonces (created_at);

GRANT ALL ON public.integration_nonces TO service_role;
ALTER TABLE public.integration_nonces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages nonces"
  ON public.integration_nonces FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 3. Ledger safety net: one founding transaction per claim reference
CREATE UNIQUE INDEX currency_tx_founding_ref_uniq
  ON public.currency_transactions (reference_id)
  WHERE reason = 'founding_credit';

-- 4. Award function (server-side only, fixed amount)
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
BEGIN
  SELECT * INTO v_claim FROM public.founding_credit_claims
    WHERE id = p_claim_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','not_found');
  END IF;

  IF v_claim.status = 'claimed' THEN
    SELECT coin_balance INTO v_new_balance FROM public.currency_balances WHERE user_id = v_claim.main_user_id;
    RETURN jsonb_build_object(
      'status','already_claimed',
      'main_user_id', v_claim.main_user_id,
      'credits_awarded', v_claim.credits_awarded,
      'balance', COALESCE(v_new_balance, 0),
      'transaction_id', v_claim.transaction_id
    );
  END IF;

  IF v_claim.status <> 'pending' THEN
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

REVOKE ALL ON FUNCTION public.claim_founding_credits(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_founding_credits(uuid, uuid) TO service_role;

-- 5. Fix broken award_coins and lock it down
CREATE OR REPLACE FUNCTION public.award_coins(p_user_id uuid, p_amount integer, p_reason text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  INSERT INTO public.currency_balances (user_id, coin_balance, updated_at)
  VALUES (p_user_id, p_amount, now())
  ON CONFLICT (user_id) DO UPDATE
    SET coin_balance = public.currency_balances.coin_balance + p_amount,
        updated_at = now()
  RETURNING coin_balance INTO v_new_balance;

  INSERT INTO public.currency_transactions (
    user_id, currency_type, transaction_type, amount, balance_after, reason, metadata
  ) VALUES (
    p_user_id, 'coins', 'reward', p_amount, v_new_balance, p_reason, p_metadata
  );
END;
$$;

REVOKE ALL ON FUNCTION public.award_coins(uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_coins(uuid, integer, text, jsonb) TO service_role;

-- 6. Users may no longer edit their own balance
DROP POLICY IF EXISTS "Users can update own currency balance" ON public.currency_balances;
REVOKE UPDATE ON public.currency_balances FROM authenticated, anon;