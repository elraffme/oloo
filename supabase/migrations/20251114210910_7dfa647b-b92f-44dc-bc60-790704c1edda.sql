-- Drop existing functions to replace them with timezone-aware versions
DROP FUNCTION IF EXISTS get_login_streak_info();
DROP FUNCTION IF EXISTS claim_daily_login_reward();

-- Timezone-aware function to get login streak info
CREATE OR REPLACE FUNCTION get_login_streak_info(p_tz_offset_minutes integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_current_streak integer := 0;
  v_claimed_today boolean := false;
  v_last_login_date date;
  v_local_date date;
  v_day_in_month integer;
  v_coins_today integer;
  v_xp_today integer;
  v_is_milestone_today boolean := false;
  v_milestone_type_today text;
  v_next_milestone_days integer;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Calculate local date based on timezone offset
  v_local_date := (now() - make_interval(mins => p_tz_offset_minutes))::date;

  -- Get last login record
  SELECT login_date, streak INTO v_last_login_date, v_current_streak
  FROM daily_login_rewards
  WHERE user_id = v_user_id
  ORDER BY login_date DESC
  LIMIT 1;

  -- Check if claimed today
  IF v_last_login_date = v_local_date THEN
    v_claimed_today := true;
  ELSIF v_last_login_date IS NULL THEN
    v_current_streak := 0;
  ELSIF v_last_login_date = v_local_date - 1 THEN
    -- Streak continues (will be incremented on next claim)
    v_current_streak := COALESCE(v_current_streak, 0);
  ELSE
    -- Streak broken
    v_current_streak := 0;
  END IF;

  -- Calculate day_in_month for next claim (1-30 cycle)
  IF v_claimed_today THEN
    v_day_in_month := ((v_current_streak - 1) % 30) + 1;
  ELSE
    v_day_in_month := ((v_current_streak) % 30) + 1;
  END IF;

  -- Calculate today's/next rewards based on upcoming streak day
  v_coins_today := 10 + LEAST(v_current_streak, 6) * 5;
  v_xp_today := 50 + LEAST(v_current_streak, 6) * 10;

  -- Check for milestones on next claim
  IF NOT v_claimed_today THEN
    IF (v_current_streak + 1) % 7 = 0 THEN
      v_is_milestone_today := true;
      v_milestone_type_today := 'weekly';
      v_coins_today := v_coins_today + 50;
      v_xp_today := v_xp_today + 100;
    ELSIF v_day_in_month = 30 THEN
      v_is_milestone_today := true;
      v_milestone_type_today := 'monthly';
      v_coins_today := v_coins_today + 200;
      v_xp_today := v_xp_today + 500;
    END IF;
  END IF;

  -- Calculate next milestone
  IF (v_current_streak + 1) % 7 = 0 THEN
    v_next_milestone_days := 0;
  ELSE
    v_next_milestone_days := 7 - ((v_current_streak + 1) % 7);
  END IF;

  RETURN jsonb_build_object(
    'current_streak', v_current_streak,
    'claimed_today', v_claimed_today,
    'day_in_month', v_day_in_month,
    'last_login_date', v_last_login_date,
    'coins_today', v_coins_today,
    'xp_today', v_xp_today,
    'is_milestone_today', v_is_milestone_today,
    'milestone_type_today', v_milestone_type_today,
    'next_milestone_days', v_next_milestone_days
  );
END;
$$;

-- Timezone-aware function to claim daily login reward
CREATE OR REPLACE FUNCTION claim_daily_login_reward(p_tz_offset_minutes integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_last_login_date date;
  v_current_streak integer := 0;
  v_new_streak integer;
  v_local_date date;
  v_coins_awarded integer;
  v_xp_awarded integer;
  v_day_in_month integer;
  v_is_milestone boolean := false;
  v_milestone_type text;
  v_next_milestone integer;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Calculate local date based on timezone offset
  v_local_date := (now() - make_interval(mins => p_tz_offset_minutes))::date;

  -- Get last login info
  SELECT login_date, streak INTO v_last_login_date, v_current_streak
  FROM daily_login_rewards
  WHERE user_id = v_user_id
  ORDER BY login_date DESC
  LIMIT 1;

  -- Check if already claimed today
  IF v_last_login_date = v_local_date THEN
    RETURN jsonb_build_object(
      'success', false,
      'already_claimed', true,
      'current_streak', v_current_streak,
      'day_in_month', ((v_current_streak - 1) % 30) + 1,
      'message', 'Already claimed today'
    );
  END IF;

  -- Calculate new streak
  IF v_last_login_date IS NULL THEN
    v_new_streak := 1;
  ELSIF v_last_login_date = v_local_date - 1 THEN
    v_new_streak := v_current_streak + 1;
  ELSE
    v_new_streak := 1; -- Streak broken
  END IF;

  -- Calculate day in month (1-30 cycle)
  v_day_in_month := ((v_new_streak - 1) % 30) + 1;

  -- Calculate base rewards
  v_coins_awarded := 10 + LEAST(v_new_streak - 1, 6) * 5;
  v_xp_awarded := 50 + LEAST(v_new_streak - 1, 6) * 10;

  -- Check for milestones
  IF v_new_streak % 7 = 0 THEN
    v_is_milestone := true;
    v_milestone_type := 'weekly';
    v_coins_awarded := v_coins_awarded + 50;
    v_xp_awarded := v_xp_awarded + 100;
  ELSIF v_day_in_month = 30 THEN
    v_is_milestone := true;
    v_milestone_type := 'monthly';
    v_coins_awarded := v_coins_awarded + 200;
    v_xp_awarded := v_xp_awarded + 500;
  END IF;

  -- Calculate next milestone
  IF v_new_streak % 7 = 0 THEN
    v_next_milestone := 7;
  ELSE
    v_next_milestone := 7 - (v_new_streak % 7);
  END IF;

  -- Insert login record
  INSERT INTO daily_login_rewards (user_id, login_date, streak)
  VALUES (v_user_id, v_local_date, v_new_streak)
  ON CONFLICT (user_id, login_date) DO NOTHING;

  -- Award coins and XP
  PERFORM award_coins(v_user_id, v_coins_awarded, 'daily_login_reward');
  PERFORM award_xp(v_user_id, v_xp_awarded, 'daily_login_reward');

  RETURN jsonb_build_object(
    'success', true,
    'coins_awarded', v_coins_awarded,
    'xp_awarded', v_xp_awarded,
    'current_streak', v_new_streak,
    'day_in_month', v_day_in_month,
    'is_milestone', v_is_milestone,
    'milestone_type', v_milestone_type,
    'next_milestone', v_next_milestone,
    'already_claimed', false
  );
END;
$$;