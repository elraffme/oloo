CREATE OR REPLACE FUNCTION public.get_daily_trivia_question(p_user_id uuid)
 RETURNS TABLE(id uuid, question text, options jsonb, category text, difficulty text, coin_reward integer, already_answered boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_today date := CURRENT_DATE;
  v_question_id uuid;
  v_count integer;
  v_index integer;
BEGIN
  -- 1) If the user already answered a question today, always return that same one
  SELECT ta.question_id INTO v_question_id
  FROM trivia_answers ta
  WHERE ta.user_id = p_user_id
    AND (ta.answered_at AT TIME ZONE 'UTC')::date = v_today
  ORDER BY ta.answered_at DESC
  LIMIT 1;

  -- 2) Otherwise pick a deterministic question for this user + day
  IF v_question_id IS NULL THEN
    SELECT count(*) INTO v_count FROM trivia_questions tq WHERE tq.active = true;
    IF v_count = 0 THEN
      RETURN;
    END IF;

    v_index := (abs(hashtext(p_user_id::text || ':' || v_today::text)) % v_count);

    SELECT tq.id INTO v_question_id
    FROM trivia_questions tq
    WHERE tq.active = true
    ORDER BY tq.id
    OFFSET v_index
    LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT
    tq.id,
    tq.question,
    tq.options,
    tq.category,
    tq.difficulty,
    tq.coin_reward,
    EXISTS(
      SELECT 1 FROM trivia_answers ta
      WHERE ta.user_id = p_user_id
        AND (ta.answered_at AT TIME ZONE 'UTC')::date = v_today
    ) AS already_answered
  FROM trivia_questions tq
  WHERE tq.id = v_question_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_daily_trivia_question(uuid) TO authenticated;