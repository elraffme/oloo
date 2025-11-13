-- Create meet_me_interactions table for fast-paced browsing
CREATE TABLE meet_me_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  response TEXT NOT NULL CHECK (response IN ('yes', 'skip')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT different_users_meet_me CHECK (user_id <> target_user_id),
  CONSTRAINT unique_meet_me_interaction UNIQUE (user_id, target_user_id)
);

-- Create indexes
CREATE INDEX idx_meet_me_user ON meet_me_interactions(user_id, created_at DESC);
CREATE INDEX idx_meet_me_target ON meet_me_interactions(target_user_id, created_at DESC);
CREATE INDEX idx_meet_me_matches ON meet_me_interactions(user_id, target_user_id, response);

-- Enable RLS
ALTER TABLE meet_me_interactions ENABLE ROW LEVEL SECURITY;

-- Users can create their own interactions
CREATE POLICY "Users can create meet me interactions"
  ON meet_me_interactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND user_id <> target_user_id);

-- Users can view their own interactions
CREATE POLICY "Users can view their meet me interactions"
  ON meet_me_interactions
  FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = target_user_id);

-- Create meet_me_stats table for tracking streaks and rewards
CREATE TABLE meet_me_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_plays INTEGER DEFAULT 0,
  total_yeses INTEGER DEFAULT 0,
  total_skips INTEGER DEFAULT 0,
  coins_earned INTEGER DEFAULT 0,
  last_played_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE meet_me_stats ENABLE ROW LEVEL SECURITY;

-- Users can view their own stats
CREATE POLICY "Users can view own meet me stats"
  ON meet_me_stats
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own stats
CREATE POLICY "Users can insert own meet me stats"
  ON meet_me_stats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own stats
CREATE POLICY "Users can update own meet me stats"
  ON meet_me_stats
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to check for mutual "yes" and create connection
CREATE OR REPLACE FUNCTION check_meet_me_match(p_user_id UUID, p_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mutual_yes BOOLEAN;
BEGIN
  -- Check if both users said yes to each other
  SELECT EXISTS (
    SELECT 1 FROM meet_me_interactions
    WHERE user_id = p_user_id 
      AND target_user_id = p_target_user_id 
      AND response = 'yes'
  ) AND EXISTS (
    SELECT 1 FROM meet_me_interactions
    WHERE user_id = p_target_user_id 
      AND target_user_id = p_user_id 
      AND response = 'yes'
  ) INTO v_mutual_yes;

  -- If mutual yes, create a connection
  IF v_mutual_yes THEN
    INSERT INTO user_connections (user_id, connected_user_id, connection_type)
    VALUES (p_user_id, p_target_user_id, 'meet_me_match')
    ON CONFLICT DO NOTHING;
    
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Function to update meet me stats and award coins
CREATE OR REPLACE FUNCTION update_meet_me_stats(
  p_user_id UUID,
  p_response TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats RECORD;
  v_coins_awarded INTEGER := 0;
  v_streak_bonus BOOLEAN := FALSE;
  v_milestone_bonus BOOLEAN := FALSE;
BEGIN
  -- Get or create stats
  INSERT INTO meet_me_stats (user_id, total_plays, last_played_at)
  VALUES (p_user_id, 0, NOW())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_stats FROM meet_me_stats WHERE user_id = p_user_id FOR UPDATE;

  -- Check if played within last 24 hours to maintain streak
  IF v_stats.last_played_at IS NULL OR 
     (NOW() - v_stats.last_played_at) > INTERVAL '24 hours' THEN
    -- Reset streak if more than 24 hours
    UPDATE meet_me_stats 
    SET current_streak = 1,
        longest_streak = GREATEST(longest_streak, current_streak)
    WHERE user_id = p_user_id;
  ELSE
    -- Increment streak
    UPDATE meet_me_stats 
    SET current_streak = current_streak + 1,
        longest_streak = GREATEST(longest_streak, current_streak + 1)
    WHERE user_id = p_user_id;
  END IF;

  -- Update play counts
  IF p_response = 'yes' THEN
    UPDATE meet_me_stats 
    SET total_yeses = total_yeses + 1
    WHERE user_id = p_user_id;
  ELSE
    UPDATE meet_me_stats 
    SET total_skips = total_skips + 1
    WHERE user_id = p_user_id;
  END IF;

  UPDATE meet_me_stats 
  SET total_plays = total_plays + 1,
      last_played_at = NOW(),
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Refresh stats
  SELECT * INTO v_stats FROM meet_me_stats WHERE user_id = p_user_id;

  -- Award coins for milestones
  -- Every 10 plays
  IF v_stats.total_plays % 10 = 0 THEN
    v_coins_awarded := v_coins_awarded + 5;
    v_milestone_bonus := TRUE;
  END IF;

  -- Streak bonuses
  IF v_stats.current_streak % 5 = 0 AND v_stats.current_streak > 0 THEN
    v_coins_awarded := v_coins_awarded + (v_stats.current_streak / 5) * 3;
    v_streak_bonus := TRUE;
  END IF;

  -- Award coins if any
  IF v_coins_awarded > 0 THEN
    -- Update currency balance
    INSERT INTO currency_balances (user_id, coin_balance)
    VALUES (p_user_id, v_coins_awarded)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      coin_balance = currency_balances.coin_balance + v_coins_awarded,
      updated_at = NOW();

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
      p_user_id,
      'coins',
      'earn',
      v_coins_awarded,
      coin_balance,
      'Meet Me game reward',
      jsonb_build_object(
        'total_plays', v_stats.total_plays,
        'current_streak', v_stats.current_streak,
        'milestone_bonus', v_milestone_bonus,
        'streak_bonus', v_streak_bonus
      )
    FROM currency_balances WHERE user_id = p_user_id;

    UPDATE meet_me_stats 
    SET coins_earned = coins_earned + v_coins_awarded
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'current_streak', v_stats.current_streak,
    'total_plays', v_stats.total_plays,
    'coins_awarded', v_coins_awarded,
    'streak_bonus', v_streak_bonus,
    'milestone_bonus', v_milestone_bonus
  );
END;
$$;

-- Enable realtime for meet me interactions
ALTER PUBLICATION supabase_realtime ADD TABLE meet_me_interactions;