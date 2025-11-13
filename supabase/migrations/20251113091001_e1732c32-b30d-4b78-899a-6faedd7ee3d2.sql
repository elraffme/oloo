-- Update gift sending function to check VIP requirements
CREATE OR REPLACE FUNCTION send_shop_item_gift(
  p_receiver_id UUID,
  p_item_id TEXT,
  p_message TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID;
  v_item RECORD;
  v_item_price INTEGER;
  v_current_balance INTEGER;
  v_gift_id UUID;
  v_item_name TEXT;
  v_sender_tier TEXT;
BEGIN
  -- Get sender ID
  v_sender_id := auth.uid();
  
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF v_sender_id = p_receiver_id THEN
    RAISE EXCEPTION 'Cannot send gifts to yourself';
  END IF;
  
  -- Get item details and check VIP requirements
  SELECT * INTO v_item
  FROM shop_items
  WHERE id = p_item_id AND active = true;
  
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Item not found or not available';
  END IF;
  
  -- Get sender's membership tier
  SELECT membership_tier INTO v_sender_tier
  FROM profiles
  WHERE user_id = v_sender_id;
  
  IF v_sender_tier IS NULL THEN
    v_sender_tier := 'free';
  END IF;
  
  -- Check if sender can purchase VIP items (to gift them)
  IF v_item.vip_only = true AND v_sender_tier = 'free' THEN
    RAISE EXCEPTION 'This VIP item requires a premium membership to gift';
  END IF;
  
  IF v_item.required_tier IS NOT NULL THEN
    IF v_sender_tier = 'free' THEN
      RAISE EXCEPTION 'This item requires % membership to gift', v_item.required_tier;
    END IF;
    
    IF v_item.required_tier = 'gold' AND v_sender_tier NOT IN ('gold') THEN
      RAISE EXCEPTION 'This item requires Gold membership to gift';
    END IF;
  END IF;
  
  v_item_price := v_item.coin_price;
  v_item_name := v_item.name;
  
  -- Get current balance
  SELECT coin_balance INTO v_current_balance
  FROM currency_balances
  WHERE user_id = v_sender_id;
  
  IF v_current_balance IS NULL THEN
    v_current_balance := 0;
  END IF;
  
  IF v_current_balance < v_item_price THEN
    RAISE EXCEPTION 'Insufficient coins. You have % coins but need %', v_current_balance, v_item_price;
  END IF;
  
  -- Deduct coins from sender
  UPDATE currency_balances
  SET 
    coin_balance = coin_balance - v_item_price,
    lifetime_coins_spent = lifetime_coins_spent + v_item_price,
    updated_at = now()
  WHERE user_id = v_sender_id;
  
  -- Record transaction
  INSERT INTO currency_transactions (
    user_id,
    currency_type,
    transaction_type,
    amount,
    balance_after,
    reason,
    metadata
  )
  SELECT
    v_sender_id,
    'coins',
    'debit',
    v_item_price,
    coin_balance,
    'shop_item_gift_sent',
    jsonb_build_object(
      'item_id', p_item_id,
      'item_name', v_item_name,
      'receiver_id', p_receiver_id,
      'security_validated', true
    )
  FROM currency_balances
  WHERE user_id = v_sender_id;
  
  -- Create gift record
  INSERT INTO shop_item_gifts (
    sender_id,
    receiver_id,
    item_id,
    message,
    coin_cost,
    status
  )
  VALUES (
    v_sender_id,
    p_receiver_id,
    p_item_id,
    p_message,
    v_item_price,
    'pending'
  )
  RETURNING id INTO v_gift_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'gift_id', v_gift_id,
    'item_name', v_item_name,
    'coins_spent', v_item_price
  );
END;
$$;