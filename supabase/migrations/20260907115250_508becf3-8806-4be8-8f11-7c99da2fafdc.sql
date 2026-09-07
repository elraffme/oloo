CREATE OR REPLACE FUNCTION public.get_daily_trivia_quiz(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_today date := CURRENT_DATE;
  v_quiz trivia_daily_quiz%ROWTYPE;
  v_ids uuid[];
  v_questions json;
  v_cap constant int := 15;
  v_total constant int := 5;
  v_per_question constant int := 3;
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
    'coin_reward', v_per_question
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
    'daily_limit', v_cap,
    'points_per_question', v_per_question
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_trivia_answer(p_user_id uuid, p_question_id uuid, p_user_answer text, p_time_taken_seconds integer DEFAULT 0)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_today date := CURRENT_DATE;
  v_quiz trivia_daily_quiz%ROWTYPE;
  v_question trivia_questions%ROWTYPE;
  v_is_correct boolean;
  v_cap constant int := 15;
  v_per_question constant int := 3;
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
    v_potential := v_per_question;
  ELSE
    v_new_streak := 0;
  END IF;

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
    'points_per_question', v_per_question,
    'daily_limit_reached', (v_quiz.pending_coins + v_quiz.collected_coins) >= v_cap,
    'xp_result', v_xp_result
  );
END;
$function$;