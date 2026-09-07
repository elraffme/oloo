-- 1) Daily quiz session table
CREATE TABLE IF NOT EXISTS public.trivia_daily_quiz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quiz_date date NOT NULL DEFAULT CURRENT_DATE,
  question_ids uuid[] NOT NULL,
  answered_count integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  pending_coins integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  collected_at timestamptz,
  collected_coins integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, quiz_date)
);

GRANT SELECT ON public.trivia_daily_quiz TO authenticated;
GRANT ALL ON public.trivia_daily_quiz TO service_role;

ALTER TABLE public.trivia_daily_quiz ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own daily quiz" ON public.trivia_daily_quiz;
CREATE POLICY "Users can view their own daily quiz"
  ON public.trivia_daily_quiz FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_trivia_daily_quiz_updated_at ON public.trivia_daily_quiz;
CREATE TRIGGER update_trivia_daily_quiz_updated_at
  BEFORE UPDATE ON public.trivia_daily_quiz
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- allow a question to be reused on future days
DROP INDEX IF EXISTS public.trivia_answers_user_question_uidx;

-- 2) Start / resume today's quiz
CREATE OR REPLACE FUNCTION public.get_daily_trivia_quiz(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := CURRENT_DATE;
  v_quiz trivia_daily_quiz%ROWTYPE;
  v_ids uuid[];
  v_questions json;
  v_cap constant int := 15;
  v_total constant int := 5;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_quiz FROM trivia_daily_quiz
  WHERE user_id = p_user_id AND quiz_date = v_today;

  IF NOT FOUND THEN
    SELECT array_agg(q.id) INTO v_ids FROM (
      SELECT tq.id FROM trivia_questions tq
      WHERE tq.active = true
      ORDER BY md5(tq.id::text || p_user_id::text || v_today::text)
      LIMIT v_total
    ) q;

    IF v_ids IS NULL OR array_length(v_ids, 1) = 0 THEN
      RETURN json_build_object('success', false, 'error', 'No questions available');
    END IF;

    INSERT INTO trivia_daily_quiz (user_id, quiz_date, question_ids)
    VALUES (p_user_id, v_today, v_ids)
    ON CONFLICT (user_id, quiz_date) DO UPDATE SET updated_at = now()
    RETURNING * INTO v_quiz;
  END IF;

  SELECT json_agg(json_build_object(
    'id', tq.id,
    'question', tq.question,
    'options', tq.options,
    'category', tq.category,
    'difficulty', tq.difficulty,
    'coin_reward', tq.coin_reward
  ) ORDER BY array_position(v_quiz.question_ids, tq.id))
  INTO v_questions
  FROM trivia_questions tq
  WHERE tq.id = ANY(v_quiz.question_ids);

  RETURN json_build_object(
    'success', true,
    'quiz_date', v_quiz.quiz_date,
    'questions', COALESCE(v_questions, '[]'::json),
    'total_questions', COALESCE(array_length(v_quiz.question_ids, 1), 0),
    'answered_count', v_quiz.answered_count,
    'correct_count', v_quiz.correct_count,
    'pending_coins', v_quiz.pending_coins,
    'completed', v_quiz.completed_at IS NOT NULL,
    'collected', v_quiz.collected_at IS NOT NULL,
    'collected_coins', v_quiz.collected_coins,
    'daily_limit', v_cap
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_daily_trivia_quiz(uuid) TO authenticated;

-- 3) Submit an answer (points stay pending)
CREATE OR REPLACE FUNCTION public.submit_trivia_answer(
  p_user_id uuid,
  p_question_id uuid,
  p_user_answer text,
  p_time_taken_seconds integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := CURRENT_DATE;
  v_quiz trivia_daily_quiz%ROWTYPE;
  v_question trivia_questions%ROWTYPE;
  v_is_correct boolean;
  v_cap constant int := 15;
  v_coins int := 0;
  v_potential int := 0;
  v_remaining int := 0;
  v_expected uuid;
  v_xp_result json;
  v_new_streak int;
  v_last_answered date;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_quiz FROM trivia_daily_quiz
  WHERE user_id = p_user_id AND quiz_date = v_today
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'No active quiz. Reload the page.');
  END IF;

  IF v_quiz.completed_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Today''s quiz is already complete');
  END IF;

  v_expected := v_quiz.question_ids[v_quiz.answered_count + 1];
  IF v_expected IS DISTINCT FROM p_question_id THEN
    RETURN json_build_object('success', false, 'error', 'Unexpected question');
  END IF;

  SELECT * INTO v_question FROM trivia_questions WHERE id = p_question_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Question not found');
  END IF;

  v_is_correct := p_user_answer = v_question.correct_answer;

  SELECT (last_answered_at AT TIME ZONE 'UTC')::date INTO v_last_answered
  FROM trivia_stats WHERE user_id = p_user_id;

  IF v_is_correct THEN
    IF v_last_answered = v_today - 1 THEN
      SELECT current_streak + 1 INTO v_new_streak FROM trivia_stats WHERE user_id = p_user_id;
    ELSIF v_last_answered = v_today THEN
      SELECT current_streak INTO v_new_streak FROM trivia_stats WHERE user_id = p_user_id;
    ELSE
      v_new_streak := 1;
    END IF;
    v_new_streak := GREATEST(COALESCE(v_new_streak, 1), 1);
    v_potential := COALESCE(v_question.coin_reward, 0);
  ELSE
    v_new_streak := 0;
  END IF;

  -- hard server-side daily cap: pending + already collected today
  v_remaining := GREATEST(v_cap - v_quiz.pending_coins - v_quiz.collected_coins, 0);
  v_coins := LEAST(v_potential, v_remaining);

  INSERT INTO trivia_answers (
    user_id, question_id, user_answer, is_correct, coins_earned, time_taken_seconds
  ) VALUES (
    p_user_id, p_question_id, p_user_answer, v_is_correct, v_coins, p_time_taken_seconds
  );

  UPDATE trivia_daily_quiz
  SET answered_count = answered_count + 1,
      correct_count = correct_count + CASE WHEN v_is_correct THEN 1 ELSE 0 END,
      pending_coins = pending_coins + v_coins,
      completed_at = CASE
        WHEN answered_count + 1 >= COALESCE(array_length(question_ids, 1), 0) THEN now()
        ELSE completed_at END,
      updated_at = now()
  WHERE id = v_quiz.id
  RETURNING * INTO v_quiz;

  INSERT INTO trivia_stats (
    user_id, total_questions_answered, correct_answers, total_coins_earned,
    current_streak, longest_streak, last_answered_at
  ) VALUES (
    p_user_id, 1, CASE WHEN v_is_correct THEN 1 ELSE 0 END, 0,
    v_new_streak, v_new_streak, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_questions_answered = trivia_stats.total_questions_answered + 1,
    correct_answers = trivia_stats.correct_answers + CASE WHEN v_is_correct THEN 1 ELSE 0 END,
    current_streak = v_new_streak,
    longest_streak = GREATEST(trivia_stats.longest_streak, v_new_streak),
    last_answered_at = NOW(),
    updated_at = NOW();

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
    'coins_earned', v_coins,
    'pending_coins', v_quiz.pending_coins,
    'answered_count', v_quiz.answered_count,
    'correct_count', v_quiz.correct_count,
    'total_questions', COALESCE(array_length(v_quiz.question_ids, 1), 0),
    'completed', v_quiz.completed_at IS NOT NULL,
    'current_streak', v_new_streak,
    'daily_limit', v_cap,
    'daily_limit_reached', (v_quiz.pending_coins + v_quiz.collected_coins) >= v_cap,
    'xp_result', v_xp_result
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_trivia_answer(uuid, uuid, text, integer) TO authenticated;

-- 4) Collect pending rewards (idempotent)
CREATE OR REPLACE FUNCTION public.collect_trivia_rewards(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := CURRENT_DATE;
  v_cap constant int := 15;
  v_quiz trivia_daily_quiz%ROWTYPE;
  v_earned_today int := 0;
  v_award int := 0;
  v_new_balance int;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_quiz FROM trivia_daily_quiz
  WHERE user_id = p_user_id AND quiz_date = v_today
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'No quiz found for today');
  END IF;

  IF v_quiz.completed_at IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Finish all questions first');
  END IF;

  IF v_quiz.collected_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'already_collected', true,
      'error', 'Rewards already collected', 'collected_coins', v_quiz.collected_coins);
  END IF;

  INSERT INTO trivia_daily_earnings (user_id, earn_date, coins_earned)
  VALUES (p_user_id, v_today, 0)
  ON CONFLICT (user_id, earn_date) DO UPDATE SET updated_at = now()
  RETURNING coins_earned INTO v_earned_today;

  v_award := LEAST(v_quiz.pending_coins, GREATEST(v_cap - COALESCE(v_earned_today, 0), 0));

  UPDATE trivia_daily_quiz
  SET collected_at = now(),
      collected_coins = v_award,
      pending_coins = 0,
      updated_at = now()
  WHERE id = v_quiz.id AND collected_at IS NULL
  RETURNING * INTO v_quiz;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'already_collected', true,
      'error', 'Rewards already collected');
  END IF;

  IF v_award > 0 THEN
    UPDATE trivia_daily_earnings
      SET coins_earned = coins_earned + v_award, updated_at = now()
      WHERE user_id = p_user_id AND earn_date = v_today
      RETURNING coins_earned INTO v_earned_today;

    INSERT INTO currency_balances (user_id, coin_balance, updated_at)
    VALUES (p_user_id, v_award, now())
    ON CONFLICT (user_id) DO UPDATE SET
      coin_balance = currency_balances.coin_balance + v_award,
      updated_at = now()
    RETURNING coin_balance INTO v_new_balance;

    INSERT INTO currency_transactions (
      user_id, currency_type, amount, balance_after, transaction_type, reason, metadata
    ) VALUES (
      p_user_id, 'coins', v_award, v_new_balance, 'reward', 'trivia_daily_quiz',
      jsonb_build_object('quiz_date', v_today, 'correct_answers', v_quiz.correct_count)
    );

    UPDATE trivia_stats
      SET total_coins_earned = total_coins_earned + v_award, updated_at = now()
      WHERE user_id = p_user_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'coins_collected', v_award,
    'daily_limit', v_cap,
    'daily_earned', COALESCE(v_earned_today, 0)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.collect_trivia_rewards(uuid) TO authenticated;

-- 5) Daily earnings helper reports the new limit
CREATE OR REPLACE FUNCTION public.get_trivia_daily_earnings(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'daily_limit', 15,
    'daily_earned', COALESCE((
      SELECT coins_earned FROM trivia_daily_earnings
      WHERE user_id = p_user_id AND earn_date = CURRENT_DATE
    ), 0)
  )
  WHERE p_user_id = auth.uid();
$function$;