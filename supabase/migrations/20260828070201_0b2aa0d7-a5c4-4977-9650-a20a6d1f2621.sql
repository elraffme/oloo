-- 1. Stream gift catalog
UPDATE public.gifts SET name='Rose', cost_tokens=25, asset_url='🌹', category='stream', description='A rose for the streamer', rarity='common' WHERE id=1;
UPDATE public.gifts SET name='Diamond', cost_tokens=100, asset_url='💎', category='stream', description='A dazzling diamond', rarity='epic' WHERE id=3;
UPDATE public.gifts SET name='Crown', cost_tokens=250, asset_url='👑', category='stream', description='Crown the streamer', rarity='legendary' WHERE id=4;

INSERT INTO public.gifts (id, name, cost_tokens, asset_url, category, description, rarity)
VALUES
  (101, 'Like', 10, '❤️', 'stream', 'Show some love', 'common'),
  (102, 'Star', 50, '⭐', 'stream', 'You are a star', 'rare')
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name, cost_tokens=EXCLUDED.cost_tokens, asset_url=EXCLUDED.asset_url,
  category=EXCLUDED.category, description=EXCLUDED.description, rarity=EXCLUDED.rarity;

SELECT setval(pg_get_serial_sequence('public.gifts','id'), GREATEST((SELECT MAX(id) FROM public.gifts), 1000), true);

-- 2. Atomic stream gift sending
CREATE OR REPLACE FUNCTION public.send_stream_gift(
  p_receiver_id uuid,
  p_gift_id integer,
  p_stream_id uuid DEFAULT NULL,
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sender_id uuid := auth.uid();
  v_gift record;
  v_sender_balance integer;
  v_new_balance integer;
  v_receiver_gold integer;
  v_transaction_id uuid;
  v_daily_gifts_sent integer;
BEGIN
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_sender_id = p_receiver_id THEN
    RAISE EXCEPTION 'Cannot send gift to yourself';
  END IF;

  SELECT COUNT(*) INTO v_daily_gifts_sent
  FROM public.gift_transactions
  WHERE sender_id = v_sender_id AND created_at > now() - interval '24 hours';
  IF v_daily_gifts_sent >= 100 THEN
    RAISE EXCEPTION 'Daily gift limit reached';
  END IF;

  SELECT * INTO v_gift FROM public.gifts WHERE id = p_gift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid gift';
  END IF;

  PERFORM public.get_or_create_currency_balance(v_sender_id);
  PERFORM public.get_or_create_currency_balance(p_receiver_id);

  SELECT coin_balance INTO v_sender_balance
  FROM public.currency_balances WHERE user_id = v_sender_id FOR UPDATE;

  IF v_sender_balance < v_gift.cost_tokens THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  UPDATE public.currency_balances
  SET coin_balance = coin_balance - v_gift.cost_tokens,
      lifetime_coins_spent = lifetime_coins_spent + v_gift.cost_tokens,
      lifetime_gifts_sent = lifetime_gifts_sent + 1,
      updated_at = now()
  WHERE user_id = v_sender_id AND coin_balance >= v_gift.cost_tokens
  RETURNING coin_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  INSERT INTO public.gift_transactions (sender_id, receiver_id, gift_id, coin_cost, message, metadata)
  VALUES (v_sender_id, p_receiver_id, p_gift_id, v_gift.cost_tokens, p_message,
          jsonb_build_object('stream_id', p_stream_id, 'is_livestream', p_stream_id IS NOT NULL))
  RETURNING id INTO v_transaction_id;

  INSERT INTO public.currency_transactions (
    user_id, currency_type, amount, balance_after, transaction_type, reference_id, reason, metadata
  ) VALUES (
    v_sender_id, 'coins', -v_gift.cost_tokens, v_new_balance, 'gift_sent', v_transaction_id,
    'Sent gift: ' || v_gift.name,
    jsonb_build_object('stream_id', p_stream_id, 'gift_id', p_gift_id, 'gift_name', v_gift.name)
  );

  IF v_gift.cost_tokens > 0 THEN
    UPDATE public.currency_balances
    SET gold_balance = gold_balance + v_gift.cost_tokens,
        lifetime_gifts_received = lifetime_gifts_received + 1,
        updated_at = now()
    WHERE user_id = p_receiver_id
    RETURNING gold_balance INTO v_receiver_gold;

    INSERT INTO public.currency_transactions (
      user_id, currency_type, amount, balance_after, transaction_type, reference_id, reason, metadata
    ) VALUES (
      p_receiver_id, 'gold', v_gift.cost_tokens, v_receiver_gold, 'gift_received', v_transaction_id,
      'Received gift: ' || v_gift.name,
      jsonb_build_object('stream_id', p_stream_id, 'gift_id', p_gift_id, 'sender_id', v_sender_id)
    );
  ELSE
    UPDATE public.currency_balances
    SET lifetime_gifts_received = lifetime_gifts_received + 1, updated_at = now()
    WHERE user_id = p_receiver_id;
  END IF;

  UPDATE public.gifts SET purchased_count = COALESCE(purchased_count, 0) + 1 WHERE id = p_gift_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance,
    'gift_name', v_gift.name,
    'cost', v_gift.cost_tokens
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_stream_gift(uuid, integer, uuid, text) TO authenticated;

-- 3. Supporter badges
INSERT INTO public.shop_items (id, name, description, category, item_type, icon, coin_price, rarity, display_order, active)
VALUES
  ('badge_supporter_bronze','Bronze Supporter','Show your support in streams with a bronze badge','badge','stream_badge','🥉',100,'common',1,true),
  ('badge_supporter_silver','Silver Supporter','A silver supporter badge next to your name in streams','badge','stream_badge','🥈',250,'rare',2,true),
  ('badge_supporter_gold','Gold Supporter','A gold supporter badge next to your name in streams','badge','stream_badge','🥇',500,'epic',3,true),
  ('badge_supporter_diamond','Diamond Supporter','A diamond supporter badge for true fans','badge','stream_badge','💎',1000,'epic',4,true),
  ('badge_supporter_crown','Crown Supporter','The ultimate supporter badge','badge','stream_badge','👑',2500,'legendary',5,true)
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description, icon=EXCLUDED.icon,
  coin_price=EXCLUDED.coin_price, rarity=EXCLUDED.rarity, active=true;

CREATE OR REPLACE FUNCTION public.purchase_shop_item(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item record;
  v_balance integer;
  v_new_balance integer;
  v_purchase_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_item FROM public.shop_items WHERE id = p_item_id AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not available';
  END IF;

  IF v_item.available_until IS NOT NULL AND v_item.available_until < now() THEN
    RAISE EXCEPTION 'Item no longer available';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_purchases WHERE user_id = v_user_id AND item_id = p_item_id) THEN
    RAISE EXCEPTION 'You already own this item';
  END IF;

  PERFORM public.get_or_create_currency_balance(v_user_id);

  SELECT coin_balance INTO v_balance
  FROM public.currency_balances WHERE user_id = v_user_id FOR UPDATE;

  IF v_balance < v_item.coin_price THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  UPDATE public.currency_balances
  SET coin_balance = coin_balance - v_item.coin_price,
      lifetime_coins_spent = lifetime_coins_spent + v_item.coin_price,
      updated_at = now()
  WHERE user_id = v_user_id AND coin_balance >= v_item.coin_price
  RETURNING coin_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  INSERT INTO public.user_purchases (user_id, item_id, coin_price_paid)
  VALUES (v_user_id, p_item_id, v_item.coin_price)
  RETURNING id INTO v_purchase_id;

  INSERT INTO public.currency_transactions (
    user_id, currency_type, amount, balance_after, transaction_type, reference_id, reason, metadata
  ) VALUES (
    v_user_id, 'coins', -v_item.coin_price, v_new_balance, 'shop_purchase', v_purchase_id,
    'Purchased: ' || v_item.name, jsonb_build_object('item_id', p_item_id, 'category', v_item.category)
  );

  UPDATE public.shop_items SET purchased_count = COALESCE(purchased_count, 0) + 1 WHERE id = p_item_id;

  RETURN jsonb_build_object(
    'success', true,
    'item_name', v_item.name,
    'coins_spent', v_item.coin_price,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_shop_item(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.toggle_item_equipped(p_item_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_category text;
  v_new_state boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT si.category INTO v_category
  FROM public.user_purchases up
  JOIN public.shop_items si ON si.id = up.item_id
  WHERE up.user_id = v_user_id AND up.item_id = p_item_id;

  IF v_category IS NULL THEN
    RAISE EXCEPTION 'You do not own this item';
  END IF;

  SELECT NOT COALESCE(is_equipped, false) INTO v_new_state
  FROM public.user_purchases WHERE user_id = v_user_id AND item_id = p_item_id;

  IF v_new_state THEN
    UPDATE public.user_purchases up
    SET is_equipped = false
    FROM public.shop_items si
    WHERE si.id = up.item_id AND up.user_id = v_user_id AND si.category = v_category;
  END IF;

  UPDATE public.user_purchases
  SET is_equipped = v_new_state
  WHERE user_id = v_user_id AND item_id = p_item_id;

  RETURN v_new_state;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_item_equipped(text) TO authenticated;