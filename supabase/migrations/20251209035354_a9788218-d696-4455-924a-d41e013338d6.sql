-- Drop and recreate submit_trivia_answer function with fixed currency_type
DROP FUNCTION IF EXISTS submit_trivia_answer(uuid, uuid, text, integer);

CREATE FUNCTION submit_trivia_answer(
  p_user_id uuid,
  p_question_id uuid,
  p_user_answer text,
  p_time_taken_seconds int DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question trivia_questions%ROWTYPE;
  v_is_correct boolean;
  v_coins_earned int := 0;
  v_new_streak int := 1;
  v_today date := CURRENT_DATE;
  v_last_answered date;
  v_xp_result json;
BEGIN
  -- Get the question
  SELECT * INTO v_question FROM trivia_questions WHERE id = p_question_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Question not found');
  END IF;
  
  -- Check if already answered this question
  IF EXISTS (
    SELECT 1 FROM trivia_answers 
    WHERE user_id = p_user_id AND question_id = p_question_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Already answered this question');
  END IF;
  
  -- Check answer
  v_is_correct := p_user_answer = v_question.correct_answer;
  
  -- Get last answered date for streak calculation
  SELECT (last_answered_at AT TIME ZONE 'UTC')::date INTO v_last_answered
  FROM trivia_stats WHERE user_id = p_user_id;
  
  -- Calculate streak
  IF v_is_correct THEN
    v_coins_earned := v_question.coin_reward;
    
    IF v_last_answered = v_today - 1 THEN
      SELECT current_streak + 1 INTO v_new_streak FROM trivia_stats WHERE user_id = p_user_id;
    ELSIF v_last_answered = v_today THEN
      SELECT current_streak INTO v_new_streak FROM trivia_stats WHERE user_id = p_user_id;
    ELSE
      v_new_streak := 1;
    END IF;
    
    IF v_new_streak >= 7 THEN
      v_coins_earned := v_coins_earned + 5;
    ELSIF v_new_streak >= 3 THEN
      v_coins_earned := v_coins_earned + 2;
    END IF;
  ELSE
    v_new_streak := 0;
  END IF;
  
  -- Record the answer
  INSERT INTO trivia_answers (
    user_id, question_id, user_answer, is_correct, coins_earned, time_taken_seconds
  ) VALUES (
    p_user_id, p_question_id, p_user_answer, v_is_correct, v_coins_earned, p_time_taken_seconds
  );
  
  -- Update or create stats
  INSERT INTO trivia_stats (
    user_id, total_questions_answered, correct_answers, total_coins_earned,
    current_streak, longest_streak, last_answered_at
  ) VALUES (
    p_user_id, 1, 
    CASE WHEN v_is_correct THEN 1 ELSE 0 END,
    v_coins_earned, v_new_streak, v_new_streak, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_questions_answered = trivia_stats.total_questions_answered + 1,
    correct_answers = trivia_stats.correct_answers + CASE WHEN v_is_correct THEN 1 ELSE 0 END,
    total_coins_earned = trivia_stats.total_coins_earned + v_coins_earned,
    current_streak = v_new_streak,
    longest_streak = GREATEST(trivia_stats.longest_streak, v_new_streak),
    last_answered_at = NOW(),
    updated_at = NOW();
  
  -- Award coins if correct (fixed: use 'coins' instead of 'coin')
  IF v_is_correct AND v_coins_earned > 0 THEN
    INSERT INTO currency_transactions (
      user_id, currency_type, amount, balance_after, transaction_type, reference_id, reason, metadata
    )
    SELECT 
      p_user_id,
      'coins',
      v_coins_earned,
      COALESCE((SELECT coin_balance FROM currency_balances WHERE user_id = p_user_id), 0) + v_coins_earned,
      'earn',
      NULL,
      'trivia_correct_answer',
      json_build_object('streak', v_new_streak, 'question_id', p_question_id);
    
    INSERT INTO currency_balances (user_id, coin_balance)
    VALUES (p_user_id, v_coins_earned)
    ON CONFLICT (user_id) DO UPDATE SET
      coin_balance = currency_balances.coin_balance + v_coins_earned,
      updated_at = NOW();
    
    SELECT award_xp(
      p_user_id := p_user_id,
      p_amount := 10,
      p_source_type := 'trivia',
      p_source_id := p_question_id::text,
      p_reason := 'Correct trivia answer'
    ) INTO v_xp_result;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'is_correct', v_is_correct,
    'correct_answer', v_question.correct_answer,
    'coins_earned', v_coins_earned,
    'current_streak', v_new_streak,
    'xp_result', v_xp_result
  );
END;
$$;