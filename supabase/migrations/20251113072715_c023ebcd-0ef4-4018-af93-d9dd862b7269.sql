-- Create feed_posts table for user status updates
CREATE TABLE public.feed_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'status',
  media_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_feed_posts_user_id ON public.feed_posts(user_id, created_at DESC);
CREATE INDEX idx_feed_posts_created_at ON public.feed_posts(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

-- Users can create their own posts
CREATE POLICY "Users can create their own posts"
ON public.feed_posts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update their own posts"
ON public.feed_posts
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete their own posts"
ON public.feed_posts
FOR DELETE
USING (auth.uid() = user_id);

-- Users can view posts from friends and their own posts
CREATE POLICY "Users can view posts from friends"
ON public.feed_posts
FOR SELECT
USING (
  auth.uid() = user_id OR
  auth.uid() IN (
    SELECT user_id FROM public.user_connections
    WHERE connected_user_id = feed_posts.user_id
    AND connection_type IN ('friend', 'match')
  ) OR
  auth.uid() IN (
    SELECT connected_user_id FROM public.user_connections
    WHERE user_id = feed_posts.user_id
    AND connection_type IN ('friend', 'match')
  )
);

-- Create post_reactions table for emoji reactions
CREATE TABLE public.post_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id, reaction_type)
);

-- Create index for reactions
CREATE INDEX idx_post_reactions_post_id ON public.post_reactions(post_id);

-- Enable Row Level Security on reactions
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

-- Users can add reactions
CREATE POLICY "Users can add reactions"
ON public.post_reactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can remove their reactions
CREATE POLICY "Users can remove their reactions"
ON public.post_reactions
FOR DELETE
USING (auth.uid() = user_id);

-- Users can view all reactions
CREATE POLICY "Users can view reactions"
ON public.post_reactions
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Enable realtime for feed posts
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_reactions;