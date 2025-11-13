-- Create trivia questions table
CREATE TABLE IF NOT EXISTS public.trivia_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  options jsonb NOT NULL, -- Array of answer options
  correct_answer text NOT NULL,
  category text NOT NULL CHECK (category IN ('music', 'food', 'history', 'culture', 'language')),
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  coin_reward integer NOT NULL DEFAULT 10,
  explanation text,
  active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create trivia answers table
CREATE TABLE IF NOT EXISTS public.trivia_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_id uuid NOT NULL REFERENCES public.trivia_questions(id),
  user_answer text NOT NULL,
  is_correct boolean NOT NULL,
  coins_earned integer NOT NULL DEFAULT 0,
  time_taken_seconds integer,
  answered_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create trivia stats table
CREATE TABLE IF NOT EXISTS public.trivia_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  total_questions_answered integer DEFAULT 0,
  correct_answers integer DEFAULT 0,
  total_coins_earned integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_answered_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trivia_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trivia_questions
CREATE POLICY "Anyone can view active trivia questions"
  ON public.trivia_questions
  FOR SELECT
  USING (active = true AND auth.uid() IS NOT NULL);

-- RLS Policies for trivia_answers
CREATE POLICY "Users can insert their own answers"
  ON public.trivia_answers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own answers"
  ON public.trivia_answers
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for trivia_stats
CREATE POLICY "Users can view their own stats"
  ON public.trivia_stats
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats"
  ON public.trivia_stats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats"
  ON public.trivia_stats
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view trivia leaderboard stats"
  ON public.trivia_stats
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Function to get daily trivia question
CREATE OR REPLACE FUNCTION get_daily_trivia_question(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  question text,
  options jsonb,
  category text,
  difficulty text,
  coin_reward integer,
  already_answered boolean
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today date := CURRENT_DATE;
BEGIN
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
      AND ta.question_id = tq.id 
      AND DATE(ta.answered_at) = v_today
    ) as already_answered
  FROM trivia_questions tq
  WHERE tq.active = true
  ORDER BY RANDOM()
  LIMIT 1;
END;
$$;

-- Function to submit trivia answer
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
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_correct', v_is_correct,
    'correct_answer', v_correct_answer,
    'coins_earned', v_coins_earned,
    'current_streak', v_current_streak
  );
END;
$$;

-- Function to get trivia leaderboard
CREATE OR REPLACE FUNCTION get_trivia_leaderboard(p_limit integer DEFAULT 50)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_coins_earned integer,
  correct_answers integer,
  accuracy_percentage numeric,
  current_streak integer,
  longest_streak integer,
  rank bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ts.user_id,
    p.display_name,
    p.avatar_url,
    ts.total_coins_earned,
    ts.correct_answers,
    CASE 
      WHEN ts.total_questions_answered > 0 
      THEN ROUND((ts.correct_answers::numeric / ts.total_questions_answered::numeric) * 100, 1)
      ELSE 0
    END as accuracy_percentage,
    ts.current_streak,
    ts.longest_streak,
    ROW_NUMBER() OVER (ORDER BY ts.total_coins_earned DESC, ts.correct_answers DESC) as rank
  FROM trivia_stats ts
  JOIN profiles p ON p.user_id = ts.user_id
  WHERE ts.total_questions_answered > 0
  ORDER BY ts.total_coins_earned DESC, ts.correct_answers DESC
  LIMIT p_limit;
END;
$$;

-- Insert sample African trivia questions
INSERT INTO trivia_questions (question, options, correct_answer, category, difficulty, coin_reward, explanation) VALUES
('Which Nigerian artist is known as the "African Giant"?', '["Burna Boy", "Wizkid", "Davido", "Tiwa Savage"]', 'Burna Boy', 'music', 'easy', 10, 'Burna Boy earned the nickname "African Giant" and has won multiple international awards including a Grammy.'),
('What is Jollof rice primarily made with?', '["Rice and tomato sauce", "Rice and coconut milk", "Rice and peanut sauce", "Rice and palm oil"]', 'Rice and tomato sauce', 'food', 'easy', 10, 'Jollof rice is a beloved West African dish made with rice, tomatoes, onions, and various spices.'),
('Which African country was never colonized?', '["Ethiopia", "Kenya", "Nigeria", "Ghana"]', 'Ethiopia', 'history', 'medium', 15, 'Ethiopia and Liberia are the only African countries that were never colonized by European powers.'),
('What does "Ubuntu" mean in Zulu philosophy?', '["I am because we are", "Strength in numbers", "Unity is power", "Love conquers all"]', 'I am because we are', 'culture', 'medium', 15, 'Ubuntu is a Nguni Bantu term meaning "humanity" and embodies the philosophy of communal interconnectedness.'),
('Which West African country is the largest producer of cocoa?', '["Ivory Coast", "Ghana", "Nigeria", "Cameroon"]', 'Ivory Coast', 'food', 'medium', 15, 'Ivory Coast (Côte d''Ivoire) produces about 40% of the world''s cocoa supply.'),
('Who was the first African woman to win the Nobel Peace Prize?', '["Wangari Maathai", "Ellen Johnson Sirleaf", "Leymah Gbowee", "Nadia Murad"]', 'Wangari Maathai', 'history', 'hard', 20, 'Wangari Maathai from Kenya won the Nobel Peace Prize in 2004 for her environmental conservation work.'),
('What is the traditional Nigerian wedding attire called?', '["Aso-Ebi", "Dashiki", "Kente", "Agbada"]', 'Aso-Ebi', 'culture', 'medium', 15, 'Aso-Ebi is a uniform dress worn by family and friends at Nigerian celebrations.'),
('Which African instrument is known as the "thumb piano"?', '["Mbira", "Djembe", "Kora", "Talking Drum"]', 'Mbira', 'music', 'medium', 15, 'The Mbira (also called thumb piano or kalimba) is a traditional instrument from Zimbabwe and other parts of Africa.'),
('What is Fufu traditionally made from?', '["Cassava or yam", "Corn or wheat", "Rice or millet", "Plantain or beans"]', 'Cassava or yam', 'food', 'easy', 10, 'Fufu is a staple West African food made by pounding cassava, yam, or plantains into a smooth paste.'),
('In which year did Nigeria gain independence?', '["1960", "1957", "1963", "1970"]', '1960', 'history', 'medium', 15, 'Nigeria gained independence from British colonial rule on October 1, 1960.');
