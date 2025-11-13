-- Create profile_views table to track who viewed whose profile
CREATE TABLE public.profile_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  viewer_id UUID NOT NULL,
  viewed_profile_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_repeat_view BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_profile_views_viewed ON public.profile_views(viewed_profile_id, viewed_at DESC);
CREATE INDEX idx_profile_views_viewer ON public.profile_views(viewer_id, viewed_at DESC);

-- Enable Row Level Security
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile views (who viewed them)
CREATE POLICY "Users can view who viewed their profile"
ON public.profile_views
FOR SELECT
USING (auth.uid() = viewed_profile_id);

-- System can insert profile views
CREATE POLICY "Authenticated users can create profile views"
ON public.profile_views
FOR INSERT
WITH CHECK (auth.uid() = viewer_id AND viewer_id <> viewed_profile_id);

-- Function to check if this is a repeat view (viewed in last 24 hours)
CREATE OR REPLACE FUNCTION public.check_repeat_view(p_viewer_id UUID, p_viewed_profile_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profile_views
    WHERE viewer_id = p_viewer_id
    AND viewed_profile_id = p_viewed_profile_id
    AND viewed_at > now() - interval '24 hours'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record profile view
CREATE OR REPLACE FUNCTION public.record_profile_view(p_viewed_profile_id UUID)
RETURNS void AS $$
DECLARE
  v_viewer_id UUID;
  v_is_repeat BOOLEAN;
BEGIN
  v_viewer_id := auth.uid();
  
  -- Don't record if viewing own profile
  IF v_viewer_id = p_viewed_profile_id OR v_viewer_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if this is a repeat view
  v_is_repeat := check_repeat_view(v_viewer_id, p_viewed_profile_id);
  
  -- Insert the view record
  INSERT INTO public.profile_views (viewer_id, viewed_profile_id, is_repeat_view)
  VALUES (v_viewer_id, p_viewed_profile_id, v_is_repeat);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for profile views
ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_views;