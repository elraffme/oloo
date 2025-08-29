-- Create video verification requests table
CREATE TABLE public.video_verification_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  requester_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  call_link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.video_verification_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create verification requests" 
ON public.video_verification_requests 
FOR INSERT 
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can view requests they sent or received" 
ON public.video_verification_requests 
FOR SELECT 
USING (auth.uid() = requester_id OR auth.uid() = target_user_id);

CREATE POLICY "Target users can update request status" 
ON public.video_verification_requests 
FOR UPDATE 
USING (auth.uid() = target_user_id)
WITH CHECK (auth.uid() = target_user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_video_verification_requests_updated_at
BEFORE UPDATE ON public.video_verification_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_at_column();