-- Create user levels table
CREATE TABLE IF NOT EXISTS public.user_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  current_level integer NOT NULL DEFAULT 1,
  current_xp integer NOT NULL DEFAULT 0,
  total_xp_earned integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create XP history table for tracking
CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  reason text NOT NULL,
  source_type text NOT NULL, -- 'trivia', 'achievement', 'social', 'profile', 'streak', etc.
  source_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_levels
CREATE POLICY "Users can view their own level"
  ON public.user_levels
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own level"
  ON public.user_levels
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own level"
  ON public.user_levels
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view other users' levels"
  ON public.user_levels
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for xp_transactions
CREATE POLICY "Users can view their own XP transactions"
  ON public.xp_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert XP transactions"
  ON public.xp_transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to calculate level from XP
-- Uses exponential curve: Level = floor(sqrt(XP / 100)) + 1
-- XP needed for each level increases: L1=0, L2=100, L3=400, L4=900, L5=1600, etc.
CREATE OR REPLACE FUNCTION calculate_level_from_xp(xp integer)
RETURNS integer LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN GREATEST(1, FLOOR(SQRT(xp::numeric / 100.0)) + 1);
END;
$$;

-- Function to calculate XP needed for next level
CREATE OR REPLACE FUNCTION xp_for_next_level(current_level integer)
RETURNS integer LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  -- XP needed to reach next level = (next_level - 1)^2 * 100
  RETURN (current_level * current_level * 100);
END;
$$;

-- Function to award XP to user
CREATE OR REPLACE FUNCTION award_xp(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_source_type text,
  p_source_id text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old_level integer;
  v_new_level integer;
  v_new_total_xp integer;
  v_current_xp integer;
  v_level_up boolean := false;
BEGIN
  -- Create user_levels record if it doesn't exist
  INSERT INTO user_levels (user_id, current_level, current_xp, total_xp_earned)
  VALUES (p_user_id, 1, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get current level
  SELECT current_level, total_xp_earned 
  INTO v_old_level, v_new_total_xp
  FROM user_levels
  WHERE user_id = p_user_id;

  -- Add XP
  v_new_total_xp := v_new_total_xp + p_amount;
  v_new_level := calculate_level_from_xp(v_new_total_xp);
  
  -- Calculate current XP in level (XP beyond what was needed for current level)
  v_current_xp := v_new_total_xp - ((v_new_level - 1) * (v_new_level - 1) * 100);
  
  -- Check if leveled up
  v_level_up := v_new_level > v_old_level;

  -- Update user level
  UPDATE user_levels
  SET 
    current_level = v_new_level,
    current_xp = v_current_xp,
    total_xp_earned = v_new_total_xp,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Record XP transaction
  INSERT INTO xp_transactions (user_id, amount, reason, source_type, source_id)
  VALUES (p_user_id, p_amount, p_reason, p_source_type, p_source_id);

  -- Award bonus coins for leveling up
  IF v_level_up THEN
    -- Award coins equal to new level * 50
    INSERT INTO currency_balances (user_id, coin_balance)
    VALUES (p_user_id, v_new_level * 50)
    ON CONFLICT (user_id) DO UPDATE SET
      coin_balance = currency_balances.coin_balance + (v_new_level * 50),
      updated_at = now();

    -- Record transaction
    INSERT INTO currency_transactions (
      user_id,
      transaction_type,
      currency_type,
      amount,
      balance_after,
      reason,
      metadata
    )
    SELECT
      p_user_id,
      'earn',
      'coin',
      v_new_level * 50,
      cb.coin_balance,
      'level_up_bonus',
      jsonb_build_object('old_level', v_old_level, 'new_level', v_new_level)
    FROM currency_balances cb
    WHERE cb.user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'xp_awarded', p_amount,
    'old_level', v_old_level,
    'new_level', v_new_level,
    'current_xp', v_current_xp,
    'total_xp', v_new_total_xp,
    'level_up', v_level_up,
    'coins_awarded', CASE WHEN v_level_up THEN v_new_level * 50 ELSE 0 END,
    'xp_for_next_level', xp_for_next_level(v_new_level)
  );
END;
$$;

-- Update submit_trivia_answer function to award XP
CREATE OR REPLACE FUNCTION submit_trivia_answer(
  p_user_id uuid,
  p_question_id uuid,
  p_user_answer text,
  p_time_taken_seconds integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_correct_answer text;
  v_is_correct boolean;
  v_coin_reward integer;
  v_coins_earned integer := 0;
  v_current_streak integer := 0;
  v_today date := CURRENT_DATE;
  v_xp_result jsonb;
BEGIN
  -- Check if user already answered this question today
  IF EXISTS(
    SELECT 1 FROM trivia_answers 
    WHERE user_id = p_user_id 
    AND question_id = p_question_id 
    AND DATE(answered_at) = v_today
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Already answered today',
      'is_correct', false,
      'coins_earned', 0
    );
  END IF;

  -- Get correct answer and reward
  SELECT correct_answer, coin_reward 
  INTO v_correct_answer, v_coin_reward
  FROM trivia_questions
  WHERE id = p_question_id;

  -- Check if answer is correct
  v_is_correct := (LOWER(TRIM(p_user_answer)) = LOWER(TRIM(v_correct_answer)));
  
  IF v_is_correct THEN
    v_coins_earned := v_coin_reward;
  END IF;

  -- Insert answer record
  INSERT INTO trivia_answers (
    user_id, 
    question_id, 
    user_answer, 
    is_correct, 
    coins_earned, 
    time_taken_seconds
  ) VALUES (
    p_user_id,
    p_question_id,
    p_user_answer,
    v_is_correct,
    v_coins_earned,
    p_time_taken_seconds
  );

  -- Update or create trivia stats
  INSERT INTO trivia_stats (
    user_id,
    total_questions_answered,
    correct_answers,
    total_coins_earned,
    current_streak,
    longest_streak,
    last_answered_at
  ) VALUES (
    p_user_id,
    1,
    CASE WHEN v_is_correct THEN 1 ELSE 0 END,
    v_coins_earned,
    CASE WHEN v_is_correct THEN 1 ELSE 0 END,
    CASE WHEN v_is_correct THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_questions_answered = trivia_stats.total_questions_answered + 1,
    correct_answers = trivia_stats.correct_answers + CASE WHEN v_is_correct THEN 1 ELSE 0 END,
    total_coins_earned = trivia_stats.total_coins_earned + v_coins_earned,
    current_streak = CASE 
      WHEN v_is_correct THEN trivia_stats.current_streak + 1
      ELSE 0
    END,
    longest_streak = GREATEST(
      trivia_stats.longest_streak,
      CASE WHEN v_is_correct THEN trivia_stats.current_streak + 1 ELSE 0 END
    ),
    last_answered_at = now(),
    updated_at = now();

  -- Get updated streak
  SELECT current_streak INTO v_current_streak
  FROM trivia_stats
  WHERE user_id = p_user_id;

  -- Award coins if correct
  IF v_is_correct THEN
    -- Update currency balance
    INSERT INTO currency_balances (user_id, coin_balance)
    VALUES (p_user_id, v_coins_earned)
    ON CONFLICT (user_id) DO UPDATE SET
      coin_balance = currency_balances.coin_balance + v_coins_earned,
      updated_at = now();

    -- Record transaction
    INSERT INTO currency_transactions (
      user_id,
      transaction_type,
      currency_type,
      amount,
      balance_after,
      reason,
      metadata
    )
    SELECT
      p_user_id,
      'earn',
      'coin',
      v_coins_earned,
      cb.coin_balance,
      'trivia_correct_answer',
      jsonb_build_object('question_id', p_question_id, 'streak', v_current_streak)
    FROM currency_balances cb
    WHERE cb.user_id = p_user_id;

    -- Award XP (20 XP for correct answer, +5 XP per streak day)
    SELECT award_xp(
      p_user_id,
      20 + (v_current_streak * 5),
      'Answered trivia question correctly',
      'trivia',
      p_question_id::text
    ) INTO v_xp_result;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_correct', v_is_correct,
    'correct_answer', v_correct_answer,
    'coins_earned', v_coins_earned,
    'current_streak', v_current_streak,
    'xp_result', v_xp_result
  );
END;
$$;

-- Update check_and_award_achievements to award XP
CREATE OR REPLACE FUNCTION check_and_award_achievements(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_achievement record;
  v_new_achievements jsonb := '[]'::jsonb;
  v_achievement_data jsonb;
  v_count integer;
  v_xp_amount integer;
BEGIN
  -- Loop through all achievements
  FOR v_achievement IN 
    SELECT * FROM achievements 
    WHERE id NOT IN (
      SELECT achievement_id FROM user_achievements WHERE user_id = p_user_id
    )
  LOOP
    v_count := 0;
    
    -- Check achievement requirements based on type
    CASE v_achievement.requirement_type
      WHEN 'social_interactions_sent' THEN
        SELECT COUNT(*) INTO v_count
        FROM social_interactions
        WHERE from_user_id = p_user_id;
        
      WHEN 'profile_views_received' THEN
        SELECT COUNT(*) INTO v_count
        FROM profile_views
        WHERE viewed_profile_id = p_user_id;
        
      WHEN 'streams_hosted' THEN
        SELECT COUNT(*) INTO v_count
        FROM streaming_sessions
        WHERE host_user_id = p_user_id;
        
      WHEN 'meet_me_plays' THEN
        SELECT total_plays INTO v_count
        FROM meet_me_stats
        WHERE user_id = p_user_id;
        
      WHEN 'achievements_unlocked' THEN
        SELECT COUNT(*) INTO v_count
        FROM user_achievements
        WHERE user_id = p_user_id;
        
      ELSE
        v_count := 0;
    END CASE;
    
    -- Award achievement if requirement met
    IF v_count >= v_achievement.requirement_value THEN
      -- Insert achievement
      INSERT INTO user_achievements (user_id, achievement_id, progress)
      VALUES (p_user_id, v_achievement.id, v_count)
      ON CONFLICT DO NOTHING;
      
      -- Award coins
      IF v_achievement.coin_reward > 0 THEN
        INSERT INTO currency_balances (user_id, coin_balance)
        VALUES (p_user_id, v_achievement.coin_reward)
        ON CONFLICT (user_id) DO UPDATE SET
          coin_balance = currency_balances.coin_balance + v_achievement.coin_reward,
          updated_at = now();
          
        INSERT INTO currency_transactions (
          user_id,
          transaction_type,
          currency_type,
          amount,
          balance_after,
          reason,
          metadata
        )
        SELECT
          p_user_id,
          'earn',
          'coin',
          v_achievement.coin_reward,
          cb.coin_balance,
          'achievement_unlocked',
          jsonb_build_object('achievement_id', v_achievement.id, 'achievement_name', v_achievement.name)
        FROM currency_balances cb
        WHERE cb.user_id = p_user_id;
      END IF;

      -- Award XP based on tier (bronze=30, silver=50, gold=75, platinum=100)
      v_xp_amount := CASE v_achievement.tier
        WHEN 'bronze' THEN 30
        WHEN 'silver' THEN 50
        WHEN 'gold' THEN 75
        WHEN 'platinum' THEN 100
        ELSE 30
      END;

      PERFORM award_xp(
        p_user_id,
        v_xp_amount,
        'Unlocked achievement: ' || v_achievement.name,
        'achievement',
        v_achievement.id
      );
      
      -- Add to new achievements list
      v_achievement_data := jsonb_build_object(
        'id', v_achievement.id,
        'name', v_achievement.name,
        'description', v_achievement.description,
        'icon', v_achievement.icon,
        'tier', v_achievement.tier,
        'coin_reward', v_achievement.coin_reward,
        'xp_reward', v_xp_amount
      );
      v_new_achievements := v_new_achievements || jsonb_build_array(v_achievement_data);
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object('new_achievements', v_new_achievements);
END;
$$;

-- Add XP for social interactions
CREATE OR REPLACE FUNCTION award_social_interaction_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Award 10 XP for social interactions
  PERFORM award_xp(
    NEW.from_user_id,
    10,
    'Sent ' || NEW.interaction_type,
    'social',
    NEW.id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER social_interaction_xp_trigger
  AFTER INSERT ON social_interactions
  FOR EACH ROW
  EXECUTE FUNCTION award_social_interaction_xp();

-- Add XP for profile views
CREATE OR REPLACE FUNCTION award_profile_view_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Award 5 XP to the person viewing (engagement)
  PERFORM award_xp(
    NEW.viewer_id,
    5,
    'Viewed a profile',
    'profile',
    NEW.id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER profile_view_xp_trigger
  AFTER INSERT ON profile_views
  FOR EACH ROW
  EXECUTE FUNCTION award_profile_view_xp();

-- Add XP for Meet Me interactions
CREATE OR REPLACE FUNCTION award_meet_me_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Award XP based on response (yes=15, skip=5)
  PERFORM award_xp(
    NEW.user_id,
    CASE NEW.response
      WHEN 'yes' THEN 15
      WHEN 'skip' THEN 5
      ELSE 10
    END,
    'Meet Me: ' || NEW.response,
    'meet_me',
    NEW.id::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER meet_me_xp_trigger
  AFTER INSERT ON meet_me_interactions
  FOR EACH ROW
  EXECUTE FUNCTION award_meet_me_xp();
