-- Create shop_items table
CREATE TABLE IF NOT EXISTS public.shop_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('badge', 'theme', 'emoji', 'customization')),
  item_type TEXT NOT NULL,
  icon TEXT NOT NULL,
  coin_price INTEGER NOT NULL CHECK (coin_price >= 0),
  asset_data JSONB DEFAULT '{}'::jsonb,
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  limited_edition BOOLEAN DEFAULT false,
  available_until TIMESTAMP WITH TIME ZONE,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  purchased_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  vip_only BOOLEAN DEFAULT false,
  required_tier TEXT,
  is_seasonal BOOLEAN DEFAULT false,
  season TEXT,
  available_from TIMESTAMP WITH TIME ZONE,
  recurring_annual BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to view active items
CREATE POLICY "Authenticated users can view active shop items"
  ON public.shop_items
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND active = true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shop_items_category ON public.shop_items(category);
CREATE INDEX IF NOT EXISTS idx_shop_items_active ON public.shop_items(active);
CREATE INDEX IF NOT EXISTS idx_shop_items_seasonal ON public.shop_items(is_seasonal) WHERE is_seasonal = true;
CREATE INDEX IF NOT EXISTS idx_shop_items_vip ON public.shop_items(vip_only) WHERE vip_only = true;

-- Create user_purchases table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  coin_price_paid INTEGER NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_equipped BOOLEAN DEFAULT false,
  UNIQUE(user_id, item_id)
);

-- Enable RLS on user_purchases
ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;

-- Policies for user_purchases
CREATE POLICY "Users can view their own purchases"
  ON public.user_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create purchases"
  ON public.user_purchases
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own purchases"
  ON public.user_purchases
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes for user_purchases
CREATE INDEX IF NOT EXISTS idx_user_purchases_user ON public.user_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_item ON public.user_purchases(item_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_equipped ON public.user_purchases(user_id, is_equipped) WHERE is_equipped = true;