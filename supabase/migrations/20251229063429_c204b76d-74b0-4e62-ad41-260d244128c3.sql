-- Fix stream_chat_messages.stream_id to be UUID type to match streaming_sessions.id
-- First, drop the existing RLS policies
DROP POLICY IF EXISTS "Anyone can view stream chat messages" ON public.stream_chat_messages;
DROP POLICY IF EXISTS "Authenticated users can send chat messages" ON public.stream_chat_messages;

-- Alter the column type from text to uuid
ALTER TABLE public.stream_chat_messages 
ALTER COLUMN stream_id TYPE uuid USING stream_id::uuid;

-- Recreate the RLS policies
CREATE POLICY "Anyone can view stream chat messages" 
ON public.stream_chat_messages 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can send chat messages" 
ON public.stream_chat_messages 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);