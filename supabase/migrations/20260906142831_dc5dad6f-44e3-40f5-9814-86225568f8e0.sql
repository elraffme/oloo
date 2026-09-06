CREATE TABLE IF NOT EXISTS public.trivia_daily_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  earn_date date NOT NULL DEFAULT CURRENT_DATE,
  coins_earned integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, earn_date)
);

GRANT SELECT ON public.trivia_daily_earnings TO authenticated;
GRANT ALL ON public.trivia_daily_earnings TO service_role;

ALTER TABLE public.trivia_daily_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trivia daily earnings"
ON public.trivia_daily_earnings FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS trivia_answers_user_question_uidx
  ON public.trivia_answers (user_id, question_id);

CREATE OR REPLACE FUNCTION public.submit_trivia_answer(p_user_id uuid, p_question_id uuid, p_user_answer text, p_time_taken_seconds integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_question trivia_questions%ROWTYPE;
  v_is_correct boolean;
  v_coins_earned int := 0;
  v_coins_potential int := 0;
  v_new_streak int := 1;
  v_today date := CURRENT_DATE;
  v_last_answered date;
  v_xp_result json;
  v_daily_cap constant int := 100;
  v_earned_today int := 0;
  v_remaining int := 0;
  v_new_balance int;
  v_limit_reached boolean := false;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_question FROM trivia_questions WHERE id = p_question_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Question not found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM trivia_answers
    WHERE user_id = p_user_id AND question_id = p_question_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Already answered this question');
  END IF;

  v_is_correct := p_user_answer = v_question.correct_answer;

  SELECT (last_answered_at AT TIME ZONE 'UTC')::date INTO v_last_answered
  FROM trivia_stats WHERE user_id = p_user_id;

  IF v_is_correct THEN
    v_coins_potential := v_question.coin_reward;

    IF v_last_answered = v_today - 1 THEN
      SELECT current_streak + 1 INTO v_new_streak FROM trivia_stats WHERE user_id = p_user_id;
    ELSIF v_last_answered = v_today THEN
      SELECT current_streak INTO v_new_streak FROM trivia_stats WHERE user_id = p_user_id;
    ELSE
      v_new_streak := 1;
    END IF;
    v_new_streak := COALESCE(v_new_streak, 1);

    IF v_new_streak >= 7 THEN
      v_coins_potential := v_coins_potential + 5;
    ELSIF v_new_streak >= 3 THEN
      v_coins_potential := v_coins_potential + 2;
    END IF;
  ELSE
    v_new_streak := 0;
  END IF;

  -- Reserve the daily allowance atomically
  INSERT INTO trivia_daily_earnings (user_id, earn_date, coins_earned)
  VALUES (p_user_id, v_today, 0)
  ON CONFLICT (user_id, earn_date) DO UPDATE SET updated_at = now()
  RETURNING coins_earned INTO v_earned_today;

  v_remaining := GREATEST(v_daily_cap - COALESCE(v_earned_today, 0), 0);
  v_coins_earned := LEAST(v_coins_potential, v_remaining);
  v_limit_reached := v_coins_potential > v_coins_earned;

  INSERT INTO trivia_answers (
    user_id, question_id, user_answer, is_correct, coins_earned, time_taken_seconds
  ) VALUES (
    p_user_id, p_question_id, p_user_answer, v_is_correct, v_coins_earned, p_time_taken_seconds
  );

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

  IF v_coins_earned > 0 THEN
    UPDATE trivia_daily_earnings
      SET coins_earned = coins_earned + v_coins_earned,
          updated_at = now()
      WHERE user_id = p_user_id AND earn_date = v_today
      RETURNING coins_earned INTO v_earned_today;

    INSERT INTO currency_balances (user_id, coin_balance, updated_at)
    VALUES (p_user_id, v_coins_earned, now())
    ON CONFLICT (user_id) DO UPDATE SET
      coin_balance = currency_balances.coin_balance + v_coins_earned,
      updated_at = NOW()
    RETURNING coin_balance INTO v_new_balance;

    INSERT INTO currency_transactions (
      user_id, currency_type, amount, balance_after, transaction_type, reference_id, reason, metadata
    ) VALUES (
      p_user_id, 'coins', v_coins_earned, v_new_balance, 'earn', NULL,
      'trivia_correct_answer',
      jsonb_build_object('streak', v_new_streak, 'question_id', p_question_id)
    );
  END IF;

  IF v_is_correct THEN
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
    'daily_limit', v_daily_cap,
    'daily_earned', COALESCE(v_earned_today, 0),
    'daily_remaining', GREATEST(v_daily_cap - COALESCE(v_earned_today, 0), 0),
    'daily_limit_reached', v_limit_reached OR COALESCE(v_earned_today, 0) >= v_daily_cap,
    'xp_result', v_xp_result
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_trivia_daily_earnings(p_user_id uuid)
 RETURNS json
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'daily_limit', 100,
    'daily_earned', COALESCE((
      SELECT coins_earned FROM trivia_daily_earnings
      WHERE user_id = p_user_id AND earn_date = CURRENT_DATE
    ), 0)
  )
  WHERE p_user_id = auth.uid();
$function$;