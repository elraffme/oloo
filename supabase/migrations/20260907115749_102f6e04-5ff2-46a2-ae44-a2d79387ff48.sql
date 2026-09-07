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
  v_available int;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_quiz FROM trivia_daily_quiz
  WHERE user_id = p_user_id AND quiz_date = v_today;

  IF NOT FOUND THEN
    SELECT count(*) INTO v_available FROM trivia_questions WHERE active = true;
    IF COALESCE(v_available, 0) = 0 THEN
      RETURN json_build_object('success', false, 'error', 'No questions available');
    END IF;

    -- prefer questions the user has never answered, then fill randomly; never duplicate
    SELECT array_agg(q.id) INTO v_ids FROM (
      SELECT tq.id
      FROM trivia_questions tq
      WHERE tq.active = true
      ORDER BY
        (EXISTS (SELECT 1 FROM trivia_answers ta WHERE ta.user_id = p_user_id AND ta.question_id = tq.id)),
        random()
      LIMIT LEAST(v_total, v_available)
    ) q;

    INSERT INTO trivia_daily_quiz (user_id, quiz_date, question_ids)
    VALUES (p_user_id, v_today, v_ids)
    ON CONFLICT (user_id, quiz_date) DO UPDATE SET updated_at = now()
    RETURNING * INTO v_quiz;
  END IF;

  SELECT json_agg(x.q ORDER BY array_position(v_quiz.question_ids, (x.q->>'id')::uuid))
  INTO v_questions
  FROM (
    SELECT json_build_object(
      'id', tq.id,
      'question', tq.question,
      'options', COALESCE((
        SELECT jsonb_agg(o.val ORDER BY md5(o.val || tq.id::text || p_user_id::text || v_quiz.quiz_date::text))
        FROM jsonb_array_elements_text(tq.options) AS o(val)
      ), tq.options),
      'category', tq.category,
      'difficulty', tq.difficulty,
      'coin_reward', v_per_question
    ) AS q
    FROM trivia_questions tq
    WHERE tq.id = ANY(v_quiz.question_ids)
  ) x;

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