-- Enable FULL replica identity for realtime updates on stream_chat_messages
ALTER TABLE public.stream_chat_messages REPLICA IDENTITY FULL;