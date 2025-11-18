-- Add performance indexes for streaming platform

-- Fast stream discovery: Get live streams ordered by creation date
CREATE INDEX IF NOT EXISTS idx_streaming_sessions_live_created 
  ON streaming_sessions(created_at DESC) 
  WHERE status = 'live' AND is_private = false;

-- Efficient viewer tracking: Get active viewers for a stream
CREATE INDEX IF NOT EXISTS idx_stream_viewers_heartbeat 
  ON stream_viewer_sessions(stream_id, last_heartbeat) 
  WHERE left_at IS NULL;

-- Host active streams: Find user's active broadcasts
CREATE INDEX IF NOT EXISTS idx_streaming_sessions_host_status 
  ON streaming_sessions(host_user_id, status) 
  WHERE status IN ('live', 'waiting');

-- Stream analytics: Fast viewer count queries
CREATE INDEX IF NOT EXISTS idx_stream_viewers_active 
  ON stream_viewer_sessions(stream_id, joined_at) 
  WHERE left_at IS NULL;

-- Chat message retrieval: Get recent messages for a stream
CREATE INDEX IF NOT EXISTS idx_stream_chat_messages_recent 
  ON stream_chat_messages(stream_id, created_at DESC);

-- Likes tracking: Count unique likes per stream
CREATE INDEX IF NOT EXISTS idx_stream_likes_count 
  ON stream_likes(stream_id, user_id);