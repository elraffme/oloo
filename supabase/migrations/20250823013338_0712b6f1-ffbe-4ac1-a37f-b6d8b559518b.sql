-- Enhanced user profiles with comprehensive dating app features
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS relationship_goals text DEFAULT 'Getting to know people',
ADD COLUMN IF NOT EXISTS education text,
ADD COLUMN IF NOT EXISTS height_cm integer,
ADD COLUMN IF NOT EXISTS profile_photos text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS interests text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS languages text[] DEFAULT ARRAY['English'],
ADD COLUMN IF NOT EXISTS ar_avatar_url text,
ADD COLUMN IF NOT EXISTS ar_model_data jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS membership_tier text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS prompt_responses jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_demo_profile boolean DEFAULT false;

-- Face verification system
CREATE TABLE IF NOT EXISTS public.face_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending/approved/failed
  provider text DEFAULT 'internal',
  provider_job_id text,
  score numeric,
  verification_data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Token system for virtual currency
CREATE TABLE IF NOT EXISTS public.token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  balance integer NOT NULL DEFAULT 0,
  reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Gifts catalog
CREATE TABLE IF NOT EXISTS public.gifts (
  id serial PRIMARY KEY,
  name text NOT NULL,
  cost_tokens integer NOT NULL,
  asset_url text,
  category text DEFAULT 'standard',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- User connections (matches, likes, etc.)
CREATE TABLE IF NOT EXISTS public.user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_type text NOT NULL, -- like, match, block, report
  ar_interaction_data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, connected_user_id, connection_type)
);

-- Streaming sessions for video calls and streams
CREATE TABLE IF NOT EXISTS public.streaming_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending', -- pending, live, ended
  stream_key text UNIQUE,
  started_at timestamptz,
  ended_at timestamptz,
  current_viewers integer DEFAULT 0,
  max_viewers integer DEFAULT 50,
  is_private boolean DEFAULT true,
  ar_space_data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  message_type text DEFAULT 'text', -- text, image, video, gift
  metadata jsonb DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.face_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for face_verifications
CREATE POLICY "Users can view their own verifications" ON public.face_verifications
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own verifications" ON public.face_verifications
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for token_transactions  
CREATE POLICY "Users can view their own transactions" ON public.token_transactions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage transactions" ON public.token_transactions
FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for gifts (public catalog)
CREATE POLICY "Anyone can view gifts catalog" ON public.gifts
FOR SELECT USING (true);

-- RLS Policies for messages
CREATE POLICY "Users can view their messages" ON public.messages
FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON public.messages
FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Insert some default gifts
INSERT INTO public.gifts (name, cost_tokens, asset_url, category, description) VALUES
('Rose', 10, '/assets/gifts/rose.svg', 'romantic', 'A beautiful red rose'),
('Heart', 25, '/assets/gifts/heart.svg', 'romantic', 'Show your love'),
('Diamond', 100, '/assets/gifts/diamond.svg', 'premium', 'For someone special'),
('Crown', 250, '/assets/gifts/crown.svg', 'premium', 'Make them feel royal'),
('Champagne', 50, '/assets/gifts/champagne.svg', 'celebration', 'Celebrate together')
ON CONFLICT (id) DO NOTHING;

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_face_verifications_updated_at 
    BEFORE UPDATE ON public.face_verifications 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get user token balance
CREATE OR REPLACE FUNCTION public.get_user_token_balance(target_user_id uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_balance integer;
BEGIN
  -- Only allow users to check their own balance
  IF target_user_id != auth.uid() THEN
    RETURN 0;
  END IF;
  
  SELECT balance INTO current_balance
  FROM public.token_transactions 
  WHERE user_id = target_user_id 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  RETURN COALESCE(current_balance, 0);
END;
$$;