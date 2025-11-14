-- Create helper function to award coins to users
CREATE OR REPLACE FUNCTION award_coins(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the currency balance
  INSERT INTO currency_balances (user_id, coin_balance, updated_at)
  VALUES (p_user_id, p_amount, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    coin_balance = currency_balances.coin_balance + p_amount,
    updated_at = now();
  
  -- Record the transaction
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
    'coin',
    'earn',
    p_amount,
    coin_balance,
    p_reason,
    p_metadata
  FROM currency_balances
  WHERE user_id = p_user_id;
END;
$$;

-- Recreate the claim_daily_login_reward function with proper implementation
CREATE OR REPLACE FUNCTION claim_daily_login_reward()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_last_login_date DATE;
  v_current_streak INTEGER := 0;
  v_day_in_month INTEGER := 1;
  v_coins_awarded INTEGER;
  v_xp_awarded INTEGER;
  v_is_milestone BOOLEAN := false;
  v_milestone_type TEXT := NULL;
  v_next_milestone INTEGER;
BEGIN
  -- Get the authenticated user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User not authenticated'
    );
  END IF;
  
  -- Get the last login reward date
  SELECT 
    login_date,
    day_in_streak
  INTO 
    v_last_login_date,
    v_current_streak
  FROM daily_login_rewards
  WHERE user_id = v_user_id
  ORDER BY login_date DESC
  LIMIT 1;
  
  -- Check if already claimed today
  IF v_last_login_date = CURRENT_DATE THEN
    RETURN jsonb_build_object(
      'success', false,
      'already_claimed', true,
      'message', 'You have already claimed your reward today'
    );
  END IF;
  
  -- Calculate streak
  IF v_last_login_date IS NULL OR v_last_login_date < CURRENT_DATE - INTERVAL '1 day' THEN
    -- Streak broken or first time, reset to 1
    v_current_streak := 1;
    v_day_in_month := 1;
  ELSIF v_last_login_date = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Continuing streak
    v_current_streak := v_current_streak + 1;
    v_day_in_month := v_current_streak;
  END IF;
  
  -- Calculate rewards (base + bonus for streak)
  v_coins_awarded := 10 + LEAST(v_current_streak - 1, 6) * 5;
  v_xp_awarded := 50 + LEAST(v_current_streak - 1, 6) * 10;
  
  -- Check for milestones
  IF v_current_streak % 30 = 0 THEN
    v_is_milestone := true;
    v_milestone_type := 'monthly';
    v_coins_awarded := v_coins_awarded + 200;
    v_xp_awarded := v_xp_awarded + 500;
  ELSIF v_current_streak % 7 = 0 THEN
    v_is_milestone := true;
    v_milestone_type := 'weekly';
    v_coins_awarded := v_coins_awarded + 50;
    v_xp_awarded := v_xp_awarded + 100;
  END IF;
  
  -- Calculate next milestone
  IF v_current_streak < 7 THEN
    v_next_milestone := 7 - v_current_streak;
  ELSIF v_current_streak < 30 THEN
    v_next_milestone := 30 - v_current_streak;
  ELSE
    v_next_milestone := 30 - (v_current_streak % 30);
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
    v_coins_awarded,
    v_xp_awarded,
    v_is_milestone,
    v_milestone_type
  );
  
  -- Award coins using the helper function
  PERFORM award_coins(
    v_user_id,
    v_coins_awarded,
    'Daily login reward',
    jsonb_build_object(
      'day_in_streak', v_current_streak,
      'is_milestone', v_is_milestone,
      'milestone_type', v_milestone_type
    )
  );
  
  -- Award XP using the existing function
  PERFORM award_xp(
    v_user_id,
    v_xp_awarded,
    'Daily login reward',
    NULL,
    'daily_login'
  );
  
  -- Return success with details
  RETURN jsonb_build_object(
    'success', true,
    'coins_awarded', v_coins_awarded,
    'xp_awarded', v_xp_awarded,
    'current_streak', v_current_streak,
    'day_in_month', v_day_in_month,
    'is_milestone', v_is_milestone,
    'milestone_type', v_milestone_type,
    'next_milestone', v_next_milestone,
    'message', 'Daily reward claimed successfully!'
  );
END;
$$;

-- Recreate get_login_streak_info function
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
  v_claimed_today BOOLEAN := false;
BEGIN
  -- Get the authenticated user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'current_streak', 0,
      'claimed_today', false,
      'day_in_month', 1,
      'last_login_date', NULL
    );
  END IF;
  
  -- Get the last login reward
  SELECT 
    login_date,
    day_in_streak
  INTO 
    v_last_login_date,
    v_current_streak
  FROM daily_login_rewards
  WHERE user_id = v_user_id
  ORDER BY login_date DESC
  LIMIT 1;
  
  -- Check if claimed today
  v_claimed_today := (v_last_login_date = CURRENT_DATE);
  
  -- If not claimed today and yesterday's streak exists, current streak is what it was
  -- If claimed today, that's the current streak
  -- If no login or gap, streak would be 0 (will reset on next claim)
  IF v_last_login_date IS NULL THEN
    v_current_streak := 0;
  ELSIF v_last_login_date < CURRENT_DATE - INTERVAL '1 day' THEN
    -- Streak will be broken, show 0
    v_current_streak := 0;
  END IF;
  
  RETURN jsonb_build_object(
    'current_streak', COALESCE(v_current_streak, 0),
    'claimed_today', v_claimed_today,
    'day_in_month', COALESCE(v_current_streak, 0) + 1,
    'last_login_date', v_last_login_date
  );
END;
$$;