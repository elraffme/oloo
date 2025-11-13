-- ====================================
-- COMPREHENSIVE SHOP FEATURES MIGRATION
-- Flash Sales, Wishlist, Bundles, Featured Items, Preview System
-- ====================================

-- ============ PHASE 1: FLASH SALES ============
ALTER TABLE shop_items
ADD COLUMN flash_sale_active boolean DEFAULT false,
ADD COLUMN flash_sale_discount_percent integer,
ADD COLUMN flash_sale_starts_at timestamp with time zone,
ADD COLUMN flash_sale_ends_at timestamp with time zone,
ADD COLUMN flash_sale_stock_limit integer,
ADD COLUMN flash_sale_stock_remaining integer;

-- Index for active flash sales
CREATE INDEX idx_shop_items_flash_sale ON shop_items(flash_sale_active, flash_sale_ends_at) 
WHERE flash_sale_active = true;

-- Function to purchase flash sale item
CREATE OR REPLACE FUNCTION purchase_flash_sale_item(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_item record;
  v_final_price integer;
  v_balance integer;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;
  
  -- Get item details with flash sale info
  SELECT * INTO v_item
  FROM shop_items
  WHERE id = p_item_id AND active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Item not found');
  END IF;
  
  -- Check if flash sale is active
  IF NOT v_item.flash_sale_active OR 
     v_item.flash_sale_ends_at < now() OR
     v_item.flash_sale_starts_at > now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Flash sale not active');
  END IF;
  
  -- Check stock
  IF v_item.flash_sale_stock_remaining IS NOT NULL AND v_item.flash_sale_stock_remaining <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Flash sale sold out');
  END IF;
  
  -- Check if already purchased
  IF EXISTS (SELECT 1 FROM user_purchases WHERE user_id = v_user_id AND item_id = p_item_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Already purchased');
  END IF;
  
  -- Calculate discounted price
  v_final_price := FLOOR(v_item.coin_price * (100 - v_item.flash_sale_discount_percent) / 100);
  
  -- Check balance
  SELECT coin_balance INTO v_balance FROM currency_balances WHERE user_id = v_user_id;
  IF v_balance < v_final_price THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
  END IF;
  
  -- Deduct coins
  UPDATE currency_balances
  SET coin_balance = coin_balance - v_final_price,
      lifetime_coins_spent = lifetime_coins_spent + v_final_price,
      updated_at = now()
  WHERE user_id = v_user_id;
  
  -- Create purchase
  INSERT INTO user_purchases (user_id, item_id, coin_price_paid)
  VALUES (v_user_id, p_item_id, v_final_price);
  
  -- Decrement stock
  IF v_item.flash_sale_stock_remaining IS NOT NULL THEN
    UPDATE shop_items
    SET flash_sale_stock_remaining = flash_sale_stock_remaining - 1,
        purchased_count = purchased_count + 1
    WHERE id = p_item_id;
  ELSE
    UPDATE shop_items
    SET purchased_count = purchased_count + 1
    WHERE id = p_item_id;
  END IF;
  
  -- Create transaction record
  INSERT INTO currency_transactions (user_id, currency_type, transaction_type, amount, balance_after, reason, reference_id)
  VALUES (v_user_id, 'coins', 'purchase', -v_final_price, v_balance - v_final_price, 
          'Flash sale: ' || v_item.name, p_item_id::uuid);
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Flash sale purchase successful!',
    'item_name', v_item.name,
    'coins_spent', v_final_price,
    'discount_percent', v_item.flash_sale_discount_percent
  );
END;
$$;

-- ============ PHASE 2: WISHLIST ============
CREATE TABLE shop_wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  priority integer DEFAULT 0,
  notes text,
  UNIQUE(user_id, item_id)
);

-- RLS Policies for wishlists
ALTER TABLE shop_wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wishlist"
  ON shop_wishlists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to own wishlist"
  ON shop_wishlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from own wishlist"
  ON shop_wishlists FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wishlist"
  ON shop_wishlists FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for wishlist queries
CREATE INDEX idx_shop_wishlists_user ON shop_wishlists(user_id);

-- Function to toggle wishlist
CREATE OR REPLACE FUNCTION toggle_wishlist_item(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_exists boolean;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;
  
  -- Check if exists
  SELECT EXISTS(SELECT 1 FROM shop_wishlists WHERE user_id = v_user_id AND item_id = p_item_id) INTO v_exists;
  
  IF v_exists THEN
    DELETE FROM shop_wishlists WHERE user_id = v_user_id AND item_id = p_item_id;
    RETURN jsonb_build_object('success', true, 'action', 'removed', 'in_wishlist', false);
  ELSE
    INSERT INTO shop_wishlists (user_id, item_id) VALUES (v_user_id, p_item_id);
    RETURN jsonb_build_object('success', true, 'action', 'added', 'in_wishlist', true);
  END IF;
END;
$$;

-- ============ PHASE 3: BUNDLES ============
CREATE TABLE shop_bundles (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  discount_percent integer NOT NULL,
  coin_price integer NOT NULL,
  active boolean DEFAULT true,
  limited_edition boolean DEFAULT false,
  available_until timestamp with time zone,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE shop_bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id text NOT NULL REFERENCES shop_bundles(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(bundle_id, item_id)
);

-- RLS for bundles
ALTER TABLE shop_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bundles"
  ON shop_bundles FOR SELECT
  USING (auth.uid() IS NOT NULL AND active = true);

CREATE POLICY "Authenticated users can view bundle items"
  ON shop_bundle_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX idx_shop_bundles_active ON shop_bundles(active, display_order);
CREATE INDEX idx_shop_bundle_items_bundle ON shop_bundle_items(bundle_id);

-- Function to purchase bundle
CREATE OR REPLACE FUNCTION purchase_shop_bundle(p_bundle_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_bundle record;
  v_balance integer;
  v_item_record record;
  v_items_purchased integer := 0;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;
  
  -- Get bundle
  SELECT * INTO v_bundle FROM shop_bundles WHERE id = p_bundle_id AND active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bundle not found');
  END IF;
  
  -- Check balance
  SELECT coin_balance INTO v_balance FROM currency_balances WHERE user_id = v_user_id;
  IF v_balance < v_bundle.coin_price THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
  END IF;
  
  -- Check if any items already owned
  IF EXISTS (
    SELECT 1 FROM shop_bundle_items sbi
    JOIN user_purchases up ON up.item_id = sbi.item_id AND up.user_id = v_user_id
    WHERE sbi.bundle_id = p_bundle_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'You already own some items in this bundle');
  END IF;
  
  -- Purchase all items in bundle
  FOR v_item_record IN 
    SELECT si.* FROM shop_bundle_items sbi
    JOIN shop_items si ON si.id = sbi.item_id
    WHERE sbi.bundle_id = p_bundle_id
  LOOP
    INSERT INTO user_purchases (user_id, item_id, coin_price_paid)
    VALUES (v_user_id, v_item_record.id, 0); -- Price tracked at bundle level
    
    v_items_purchased := v_items_purchased + 1;
  END LOOP;
  
  -- Deduct coins
  UPDATE currency_balances
  SET coin_balance = coin_balance - v_bundle.coin_price,
      lifetime_coins_spent = lifetime_coins_spent + v_bundle.coin_price,
      updated_at = now()
  WHERE user_id = v_user_id;
  
  -- Create transaction
  INSERT INTO currency_transactions (user_id, currency_type, transaction_type, amount, balance_after, reason)
  VALUES (v_user_id, 'coins', 'purchase', -v_bundle.coin_price, v_balance - v_bundle.coin_price, 
          'Bundle: ' || v_bundle.name);
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Bundle purchased successfully!',
    'bundle_name', v_bundle.name,
    'items_received', v_items_purchased,
    'coins_spent', v_bundle.coin_price
  );
END;
$$;

-- ============ PHASE 4: FEATURED ITEMS ============
CREATE TABLE shop_featured_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id text NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  feature_slot integer NOT NULL CHECK (feature_slot BETWEEN 1 AND 6),
  title text NOT NULL,
  description text NOT NULL,
  background_color text DEFAULT '#1a1a1a',
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(feature_slot, starts_at)
);

-- RLS for featured items
ALTER TABLE shop_featured_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view featured items"
  ON shop_featured_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Index
CREATE INDEX idx_shop_featured_items_active ON shop_featured_items(active, ends_at);

-- Function to get active featured items
CREATE OR REPLACE FUNCTION get_active_featured_items()
RETURNS TABLE (
  id uuid,
  item_id text,
  feature_slot integer,
  title text,
  description text,
  background_color text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  display_order integer,
  item_data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sfi.id,
    sfi.item_id,
    sfi.feature_slot,
    sfi.title,
    sfi.description,
    sfi.background_color,
    sfi.starts_at,
    sfi.ends_at,
    sfi.display_order,
    to_jsonb(si.*) as item_data
  FROM shop_featured_items sfi
  JOIN shop_items si ON si.id = sfi.item_id
  WHERE sfi.active = true
    AND sfi.starts_at <= now()
    AND sfi.ends_at > now()
    AND si.active = true
  ORDER BY sfi.display_order, sfi.feature_slot;
END;
$$;