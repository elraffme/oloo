-- Create stream_likes table for tracking likes
CREATE TABLE IF NOT EXISTS public.stream_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.streaming_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(stream_id, user_id)
);

-- Enable RLS
ALTER TABLE public.stream_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can like streams"
  ON public.stream_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view stream likes"
  ON public.stream_likes
  FOR SELECT
  USING (true);

CREATE POLICY "Users can unlike streams"
  ON public.stream_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add total_likes column to streaming_sessions
ALTER TABLE public.streaming_sessions
ADD COLUMN IF NOT EXISTS total_likes integer DEFAULT 0;

-- Create function to toggle like
CREATE OR REPLACE FUNCTION public.toggle_stream_like(p_stream_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_existing_like uuid;
  v_total_likes integer;
  v_liked boolean;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if like already exists
  SELECT id INTO v_existing_like
  FROM public.stream_likes
  WHERE stream_id = p_stream_id AND user_id = v_user_id;

  IF v_existing_like IS NOT NULL THEN
    -- Unlike: Delete the like
    DELETE FROM public.stream_likes WHERE id = v_existing_like;
    
    -- Decrement total_likes
    UPDATE public.streaming_sessions
    SET total_likes = GREATEST(0, total_likes - 1)
    WHERE id = p_stream_id;
    
    v_liked := false;
  ELSE
    -- Like: Insert new like
    INSERT INTO public.stream_likes (stream_id, user_id)
    VALUES (p_stream_id, v_user_id);
    
    -- Increment total_likes
    UPDATE public.streaming_sessions
    SET total_likes = total_likes + 1
    WHERE id = p_stream_id;
    
    v_liked := true;
  END IF;

  -- Get updated total likes
  SELECT total_likes INTO v_total_likes
  FROM public.streaming_sessions
  WHERE id = p_stream_id;

  RETURN jsonb_build_object(
    'liked', v_liked,
    'total_likes', v_total_likes
  );
END;
$$;

-- Enable realtime for stream_likes
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_likes;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_stream_likes_stream_id ON public.stream_likes(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_likes_user_id ON public.stream_likes(user_id);