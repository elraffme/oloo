-- Enable real-time for streaming_sessions table
ALTER TABLE streaming_sessions REPLICA IDENTITY FULL;

-- Add streaming_sessions to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE streaming_sessions;