-- Create stream chat messages table
CREATE TABLE public.stream_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.stream_chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for stream chat
CREATE POLICY "Anyone can view stream chat messages" 
ON public.stream_chat_messages 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can send chat messages" 
ON public.stream_chat_messages 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_stream_chat_stream_id ON public.stream_chat_messages(stream_id, created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_chat_messages;