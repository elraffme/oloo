-- Create daily login rewards table
CREATE TABLE IF NOT EXISTS public.daily_login_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  login_date DATE NOT NULL DEFAULT CURRENT_DATE,
  day_in_streak INTEGER NOT NULL DEFAULT 1,
  coins_awarded INTEGER NOT NULL DEFAULT 0,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  is_milestone BOOLEAN DEFAULT FALSE,
  milestone_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, login_date)
);

-- Enable RLS
ALTER TABLE public.daily_login_rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own login rewards"
  ON public.daily_login_rewards
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own login rewards"
  ON public.daily_login_rewards
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create function to claim daily login reward
CREATE OR REPLACE FUNCTION claim_daily_login_reward()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_last_login_date DATE;
  v_current_streak INTEGER := 1;
  v_day_in_month INTEGER;
  v_coins_reward INTEGER := 10;
  v_xp_reward INTEGER := 50;
  v_is_milestone BOOLEAN := FALSE;
  v_milestone_type TEXT := NULL;
  v_bonus_multiplier NUMERIC := 1.0;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if already claimed today
  IF EXISTS (
    SELECT 1 FROM daily_login_rewards
    WHERE user_id = v_user_id
    AND login_date = CURRENT_DATE
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Already claimed today',
      'already_claimed', true
    );
  END IF;

  -- Get last login date and calculate streak
  SELECT login_date, day_in_streak INTO v_last_login_date, v_current_streak
  FROM daily_login_rewards
  WHERE user_id = v_user_id
  ORDER BY login_date DESC
  LIMIT 1;

  -- Calculate streak
  IF v_last_login_date IS NULL THEN
    v_current_streak := 1;
  ELSIF v_last_login_date = CURRENT_DATE - INTERVAL '1 day' THEN
    v_current_streak := v_current_streak + 1;
  ELSIF v_last_login_date < CURRENT_DATE - INTERVAL '1 day' THEN
    v_current_streak := 1;
  END IF;

  -- Calculate day in current month cycle (1-30)
  v_day_in_month := ((v_current_streak - 1) % 30) + 1;

  -- Base rewards increase with streak (up to 7 days)
  v_coins_reward := 10 + LEAST(v_current_streak - 1, 6) * 5;
  v_xp_reward := 50 + LEAST(v_current_streak - 1, 6) * 10;

  -- Weekly milestones (every 7 days)
  IF v_current_streak % 7 = 0 THEN
    v_is_milestone := TRUE;
    v_milestone_type := 'weekly';
    v_coins_reward := v_coins_reward + 50;
    v_xp_reward := v_xp_reward + 100;
  END IF;

  -- Monthly milestones (every 30 days)
  IF v_day_in_month = 30 THEN
    v_is_milestone := TRUE;
    v_milestone_type := 'monthly';
    v_coins_reward := v_coins_reward + 200;
    v_xp_reward := v_xp_reward + 500;
  END IF;

  -- Special milestones
  IF v_current_streak = 100 THEN
    v_is_milestone := TRUE;
    v_milestone_type := 'century';
    v_coins_reward := v_coins_reward + 1000;
    v_xp_reward := v_xp_reward + 2000;
  ELSIF v_current_streak = 365 THEN
    v_is_milestone := TRUE;
    v_milestone_type := 'yearly';
    v_coins_reward := v_coins_reward + 5000;
    v_xp_reward := v_xp_reward + 10000;
  END IF;

  -- Record the login reward
  INSERT INTO daily_login_rewards (
    user_id,
    login_date,
    day_in_streak,
    coins_awarded,
    xp_awarded,
    is_milestone,
    milestone_type
  ) VALUES (
    v_user_id,
    CURRENT_DATE,
    v_current_streak,
    v_coins_reward,
    v_xp_reward,
    v_is_milestone,
    v_milestone_type
  );

  -- Award coins
  PERFORM award_coins(
    v_user_id,
    v_coins_reward,
    'daily_login',
    jsonb_build_object(
      'streak', v_current_streak,
      'day_in_month', v_day_in_month,
      'is_milestone', v_is_milestone,
      'milestone_type', v_milestone_type
    )
  );

  -- Award XP
  PERFORM award_xp(
    v_user_id,
    v_xp_reward,
    'daily_login',
    jsonb_build_object(
      'streak', v_current_streak,
      'is_milestone', v_is_milestone
    )
  );

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'coins_awarded', v_coins_reward,
    'xp_awarded', v_xp_reward,
    'current_streak', v_current_streak,
    'day_in_month', v_day_in_month,
    'is_milestone', v_is_milestone,
    'milestone_type', v_milestone_type,
    'next_milestone', CASE
      WHEN v_day_in_month < 7 THEN 7 - v_day_in_month
      WHEN v_day_in_month < 14 THEN 14 - v_day_in_month
      WHEN v_day_in_month < 21 THEN 21 - v_day_in_month
      WHEN v_day_in_month < 30 THEN 30 - v_day_in_month
      ELSE 1
    END
  );

  RETURN v_result;
END;
$$;

-- Function to get login streak info
CREATE OR REPLACE FUNCTION get_login_streak_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_last_login_date DATE;
  v_current_streak INTEGER := 0;
  v_claimed_today BOOLEAN := FALSE;
  v_day_in_month INTEGER := 1;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if claimed today
  v_claimed_today := EXISTS (
    SELECT 1 FROM daily_login_rewards
    WHERE user_id = v_user_id
    AND login_date = CURRENT_DATE
  );

  -- Get last login and streak
  SELECT login_date, day_in_streak INTO v_last_login_date, v_current_streak
  FROM daily_login_rewards
  WHERE user_id = v_user_id
  ORDER BY login_date DESC
  LIMIT 1;

  -- Check if streak is still active
  IF v_last_login_date IS NOT NULL AND v_last_login_date < CURRENT_DATE - INTERVAL '1 day' THEN
    v_current_streak := 0;
  END IF;

  v_day_in_month := ((COALESCE(v_current_streak, 0)) % 30) + 1;

  v_result := jsonb_build_object(
    'current_streak', COALESCE(v_current_streak, 0),
    'claimed_today', v_claimed_today,
    'day_in_month', v_day_in_month,
    'last_login_date', v_last_login_date
  );

  RETURN v_result;
END;
$$;