-- Create currency_balances table
CREATE TABLE IF NOT EXISTS public.currency_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  coin_balance integer DEFAULT 0 CHECK (coin_balance >= 0),
  gold_balance integer DEFAULT 0 CHECK (gold_balance >= 0),
  lifetime_coins_purchased integer DEFAULT 0,
  lifetime_coins_spent integer DEFAULT 0,
  lifetime_gifts_sent integer DEFAULT 0,
  lifetime_gifts_received integer DEFAULT 0,
  vip_tier text DEFAULT 'free' CHECK (vip_tier IN ('free', 'bronze', 'silver', 'gold', 'platinum')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create coin_packages table
CREATE TABLE IF NOT EXISTS public.coin_packages (
  id serial PRIMARY KEY,
  name text NOT NULL,
  coin_amount integer NOT NULL,
  bonus_coins integer DEFAULT 0,
  price_cents integer NOT NULL,
  currency text DEFAULT 'usd',
  popular boolean DEFAULT false,
  best_value boolean DEFAULT false,
  display_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create gift_transactions table
CREATE TABLE IF NOT EXISTS public.gift_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users NOT NULL,
  receiver_id uuid REFERENCES auth.users NOT NULL,
  gift_id integer REFERENCES public.gifts NOT NULL,
  coin_cost integer NOT NULL,
  message text,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'opened', 'expired')),
  opened_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create currency_transactions table
CREATE TABLE IF NOT EXISTS public.currency_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  currency_type text NOT NULL CHECK (currency_type IN ('coins', 'gold')),
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'gift_sent', 'gift_received', 'conversion', 'reward', 'refund')),
  reference_id uuid,
  reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Update gifts table with new columns
ALTER TABLE public.gifts
ADD COLUMN IF NOT EXISTS rarity text DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
ADD COLUMN IF NOT EXISTS animation_url text,
ADD COLUMN IF NOT EXISTS sound_url text,
ADD COLUMN IF NOT EXISTS limited_edition boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS available_until timestamptz,
ADD COLUMN IF NOT EXISTS purchased_count integer DEFAULT 0;

-- Enable RLS
ALTER TABLE public.currency_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for currency_balances
CREATE POLICY "Users can view own currency balance"
ON public.currency_balances FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own currency balance"
ON public.currency_balances FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update currency balances"
ON public.currency_balances FOR UPDATE
USING (true);

-- RLS Policies for coin_packages
CREATE POLICY "Authenticated users can view coin packages"
ON public.coin_packages FOR SELECT
USING (auth.uid() IS NOT NULL AND active = true);

-- RLS Policies for gift_transactions
CREATE POLICY "Users can view gifts they sent or received"
ON public.gift_transactions FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create gift transactions"
ON public.gift_transactions FOR INSERT
WITH CHECK (auth.uid() = sender_id AND sender_id <> receiver_id);

CREATE POLICY "Users can update received gifts"
ON public.gift_transactions FOR UPDATE
USING (auth.uid() = receiver_id);

-- RLS Policies for currency_transactions
CREATE POLICY "Users can view own currency transactions"
ON public.currency_transactions FOR SELECT
USING (auth.uid() = user_id);

-- Function to get or create currency balance
CREATE OR REPLACE FUNCTION public.get_or_create_currency_balance(p_user_id uuid)
RETURNS public.currency_balances AS $$
DECLARE
  v_balance public.currency_balances;
BEGIN
  SELECT * INTO v_balance FROM public.currency_balances WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO public.currency_balances (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_balance;
  END IF;
  
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to purchase coins
CREATE OR REPLACE FUNCTION public.purchase_coins(
  p_package_id integer,
  p_payment_intent_id text
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_package record;
  v_total_coins integer;
  v_new_balance integer;
  v_new_vip_tier text;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get package details
  SELECT * INTO v_package FROM public.coin_packages WHERE id = p_package_id AND active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid package';
  END IF;
  
  v_total_coins := v_package.coin_amount + v_package.bonus_coins;
  
  -- Ensure balance exists
  PERFORM public.get_or_create_currency_balance(v_user_id);
  
  -- Update balance
  UPDATE public.currency_balances
  SET 
    coin_balance = coin_balance + v_total_coins,
    lifetime_coins_purchased = lifetime_coins_purchased + v_total_coins,
    updated_at = now()
  WHERE user_id = v_user_id
  RETURNING coin_balance, lifetime_coins_purchased INTO v_new_balance, v_new_vip_tier;
  
  -- Calculate VIP tier based on lifetime purchases
  v_new_vip_tier := CASE
    WHEN v_new_balance >= 10000 THEN 'platinum'
    WHEN v_new_balance >= 5000 THEN 'gold'
    WHEN v_new_balance >= 2000 THEN 'silver'
    WHEN v_new_balance >= 500 THEN 'bronze'
    ELSE 'free'
  END;
  
  UPDATE public.currency_balances
  SET vip_tier = v_new_vip_tier
  WHERE user_id = v_user_id;
  
  -- Record transaction
  INSERT INTO public.currency_transactions (
    user_id, currency_type, amount, balance_after, 
    transaction_type, reference_id, reason, metadata
  ) VALUES (
    v_user_id, 'coins', v_total_coins, v_new_balance,
    'purchase', NULL, 'Coin package purchase',
    jsonb_build_object('package_id', p_package_id, 'payment_intent_id', p_payment_intent_id)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'coins_added', v_total_coins,
    'new_balance', v_new_balance,
    'vip_tier', v_new_vip_tier
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send gift
CREATE OR REPLACE FUNCTION public.send_gift(
  p_receiver_id uuid,
  p_gift_id integer,
  p_message text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_sender_id uuid;
  v_gift record;
  v_sender_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
  v_daily_gifts_sent integer;
BEGIN
  v_sender_id := auth.uid();
  
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF v_sender_id = p_receiver_id THEN
    RAISE EXCEPTION 'Cannot send gift to yourself';
  END IF;
  
  -- Check daily limit (50 gifts per day)
  SELECT COUNT(*) INTO v_daily_gifts_sent
  FROM public.gift_transactions
  WHERE sender_id = v_sender_id 
  AND created_at > now() - interval '24 hours';
  
  IF v_daily_gifts_sent >= 50 THEN
    RAISE EXCEPTION 'Daily gift limit reached';
  END IF;
  
  -- Get gift details
  SELECT * INTO v_gift FROM public.gifts WHERE id = p_gift_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid gift';
  END IF;
  
  -- Ensure sender balance exists
  PERFORM public.get_or_create_currency_balance(v_sender_id);
  
  -- Get sender balance
  SELECT coin_balance INTO v_sender_balance
  FROM public.currency_balances
  WHERE user_id = v_sender_id;
  
  IF v_sender_balance < v_gift.cost_tokens THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;
  
  -- Deduct coins from sender
  UPDATE public.currency_balances
  SET 
    coin_balance = coin_balance - v_gift.cost_tokens,
    lifetime_coins_spent = lifetime_coins_spent + v_gift.cost_tokens,
    lifetime_gifts_sent = lifetime_gifts_sent + 1,
    updated_at = now()
  WHERE user_id = v_sender_id
  RETURNING coin_balance INTO v_new_balance;
  
  -- Create gift transaction
  INSERT INTO public.gift_transactions (
    sender_id, receiver_id, gift_id, coin_cost, message
  ) VALUES (
    v_sender_id, p_receiver_id, p_gift_id, v_gift.cost_tokens, p_message
  ) RETURNING id INTO v_transaction_id;
  
  -- Record sender transaction
  INSERT INTO public.currency_transactions (
    user_id, currency_type, amount, balance_after,
    transaction_type, reference_id, reason
  ) VALUES (
    v_sender_id, 'coins', -v_gift.cost_tokens, v_new_balance,
    'gift_sent', v_transaction_id, 'Sent gift: ' || v_gift.name
  );
  
  -- Update gift purchase count
  UPDATE public.gifts
  SET purchased_count = purchased_count + 1
  WHERE id = p_gift_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to open gift
CREATE OR REPLACE FUNCTION public.open_gift(p_transaction_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_receiver_id uuid;
  v_transaction record;
  v_gold_reward integer;
  v_new_gold_balance integer;
BEGIN
  v_receiver_id := auth.uid();
  
  IF v_receiver_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get transaction
  SELECT * INTO v_transaction
  FROM public.gift_transactions
  WHERE id = p_transaction_id AND receiver_id = v_receiver_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gift not found';
  END IF;
  
  IF v_transaction.status = 'opened' THEN
    RAISE EXCEPTION 'Gift already opened';
  END IF;
  
  -- Mark as opened
  UPDATE public.gift_transactions
  SET status = 'opened', opened_at = now()
  WHERE id = p_transaction_id;
  
  -- Calculate gold reward (10% of coin cost)
  v_gold_reward := CEIL(v_transaction.coin_cost * 0.1);
  
  -- Ensure receiver balance exists
  PERFORM public.get_or_create_currency_balance(v_receiver_id);
  
  -- Award gold to receiver
  UPDATE public.currency_balances
  SET 
    gold_balance = gold_balance + v_gold_reward,
    lifetime_gifts_received = lifetime_gifts_received + 1,
    updated_at = now()
  WHERE user_id = v_receiver_id
  RETURNING gold_balance INTO v_new_gold_balance;
  
  -- Record gold transaction
  INSERT INTO public.currency_transactions (
    user_id, currency_type, amount, balance_after,
    transaction_type, reference_id, reason
  ) VALUES (
    v_receiver_id, 'gold', v_gold_reward, v_new_gold_balance,
    'gift_received', p_transaction_id, 'Received gift reward'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'gold_earned', v_gold_reward,
    'new_gold_balance', v_new_gold_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to convert gold to coins
CREATE OR REPLACE FUNCTION public.convert_gold_to_coins(p_gold_amount integer)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_current_gold integer;
  v_coins_to_add integer;
  v_new_coin_balance integer;
  v_new_gold_balance integer;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF p_gold_amount <= 0 OR p_gold_amount % 10 <> 0 THEN
    RAISE EXCEPTION 'Gold amount must be positive and divisible by 10';
  END IF;
  
  -- Ensure balance exists
  PERFORM public.get_or_create_currency_balance(v_user_id);
  
  -- Get current gold balance
  SELECT gold_balance INTO v_current_gold
  FROM public.currency_balances
  WHERE user_id = v_user_id;
  
  IF v_current_gold < p_gold_amount THEN
    RAISE EXCEPTION 'Insufficient gold';
  END IF;
  
  v_coins_to_add := p_gold_amount * 10;
  
  -- Update balances
  UPDATE public.currency_balances
  SET 
    gold_balance = gold_balance - p_gold_amount,
    coin_balance = coin_balance + v_coins_to_add,
    updated_at = now()
  WHERE user_id = v_user_id
  RETURNING coin_balance, gold_balance INTO v_new_coin_balance, v_new_gold_balance;
  
  -- Record transactions
  INSERT INTO public.currency_transactions (
    user_id, currency_type, amount, balance_after,
    transaction_type, reason
  ) VALUES 
    (v_user_id, 'gold', -p_gold_amount, v_new_gold_balance, 'conversion', 'Converted to coins'),
    (v_user_id, 'coins', v_coins_to_add, v_new_coin_balance, 'conversion', 'Converted from gold');
  
  RETURN jsonb_build_object(
    'success', true,
    'gold_spent', p_gold_amount,
    'coins_received', v_coins_to_add,
    'new_coin_balance', v_new_coin_balance,
    'new_gold_balance', v_new_gold_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default coin packages
INSERT INTO public.coin_packages (name, coin_amount, bonus_coins, price_cents, display_order, popular, best_value)
VALUES 
  ('Starter Pack', 100, 0, 99, 1, false, false),
  ('Popular Pack', 500, 100, 499, 2, true, false),
  ('Best Value', 1000, 300, 999, 3, false, true),
  ('Premium Pack', 2000, 800, 1999, 4, false, false),
  ('Ultimate Pack', 5000, 2500, 4999, 5, false, false)
ON CONFLICT DO NOTHING;

-- Update existing gifts table to use coins instead of tokens
UPDATE public.gifts SET cost_tokens = cost_tokens WHERE cost_tokens IS NOT NULL;