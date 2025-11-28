-- Add mic_enabled column to stream_viewer_sessions table
ALTER TABLE public.stream_viewer_sessions 
ADD COLUMN mic_enabled boolean DEFAULT false;