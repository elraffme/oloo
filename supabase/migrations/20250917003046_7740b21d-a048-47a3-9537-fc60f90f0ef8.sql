-- Enable real-time functionality for friend requests and messages
-- This ensures users receive friend requests and messages instantly

-- Enable real-time for user_connections table (friend requests)
ALTER TABLE public.user_connections REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_connections;

-- Enable real-time for messages table
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Add function to notify users of new friend requests
CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log the friend request notification
  PERFORM log_security_event('friend_request_notification_sent', 'user_connections', NEW.id, 
    jsonb_build_object(
      'from_user', NEW.user_id,
      'to_user', NEW.connected_user_id,
      'connection_type', NEW.connection_type,
      'real_time_enabled', true
    ));
  
  RETURN NEW;
END;
$$;

-- Add function to notify users of new messages
CREATE OR REPLACE FUNCTION public.notify_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log the message notification
  PERFORM log_security_event('message_notification_sent', 'messages', NEW.id, 
    jsonb_build_object(
      'from_user', NEW.sender_id,
      'to_user', NEW.receiver_id,
      'message_type', NEW.message_type,
      'real_time_enabled', true
    ));
  
  RETURN NEW;
END;
$$;

-- Create triggers for real-time notifications
DROP TRIGGER IF EXISTS notify_friend_request_trigger ON public.user_connections;
CREATE TRIGGER notify_friend_request_trigger
  AFTER INSERT ON public.user_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_friend_request();

DROP TRIGGER IF EXISTS notify_message_trigger ON public.messages;
CREATE TRIGGER notify_message_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_message();