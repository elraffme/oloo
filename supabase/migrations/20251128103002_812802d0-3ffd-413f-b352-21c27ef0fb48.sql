-- Add last_activity_at column to streaming_sessions to track inactivity
ALTER TABLE streaming_sessions
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now();

-- Update last_activity_at when stream starts
CREATE OR REPLACE FUNCTION update_stream_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'live' AND (OLD.status IS NULL OR OLD.status != 'live') THEN
    NEW.last_activity_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_stream_last_activity ON streaming_sessions;
CREATE TRIGGER trigger_update_stream_last_activity
  BEFORE UPDATE ON streaming_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_stream_last_activity();

-- Update last_activity_at when chat message is sent
CREATE OR REPLACE FUNCTION update_stream_activity_on_chat()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE streaming_sessions
  SET last_activity_at = now()
  WHERE id = NEW.stream_id AND status = 'live';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_activity_on_chat ON stream_chat_messages;
CREATE TRIGGER trigger_update_activity_on_chat
  AFTER INSERT ON stream_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_stream_activity_on_chat();

-- Update last_activity_at when gift is sent during livestream
CREATE OR REPLACE FUNCTION update_stream_activity_on_gift()
RETURNS TRIGGER AS $$
DECLARE
  stream_exists BOOLEAN;
BEGIN
  -- Check if the receiver is currently hosting a live stream
  SELECT EXISTS(
    SELECT 1 FROM streaming_sessions
    WHERE host_user_id = NEW.receiver_id
    AND status = 'live'
  ) INTO stream_exists;
  
  IF stream_exists THEN
    UPDATE streaming_sessions
    SET last_activity_at = now()
    WHERE host_user_id = NEW.receiver_id AND status = 'live';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_activity_on_gift ON gift_transactions;
CREATE TRIGGER trigger_update_activity_on_gift
  AFTER INSERT ON gift_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_stream_activity_on_gift();