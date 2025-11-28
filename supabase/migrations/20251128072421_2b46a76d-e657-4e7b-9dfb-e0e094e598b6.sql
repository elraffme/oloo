-- Enable full replica identity for better realtime updates on stream chat messages
ALTER TABLE public.stream_chat_messages REPLICA IDENTITY FULL;