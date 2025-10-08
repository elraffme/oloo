-- Create function to accept friend requests
CREATE OR REPLACE FUNCTION public.accept_friend_request(requester_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  existing_request record;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
  END IF;
  
  -- Check if there's a friend request from requester to current user
  SELECT * INTO existing_request
  FROM user_connections
  WHERE user_id = requester_user_id 
    AND connected_user_id = current_user_id 
    AND connection_type = 'friend_request';
  
  IF existing_request.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Friend request not found');
  END IF;
  
  -- Update the request to friend status
  UPDATE user_connections 
  SET connection_type = 'friend', updated_at = now()
  WHERE id = existing_request.id;
  
  -- Create reciprocal friend connection
  INSERT INTO user_connections (user_id, connected_user_id, connection_type)
  VALUES (current_user_id, requester_user_id, 'friend')
  ON CONFLICT DO NOTHING;
  
  -- Log the acceptance
  PERFORM log_security_event('friend_request_accepted', 'user_connections', existing_request.id, 
    jsonb_build_object(
      'requester_user_id', requester_user_id,
      'accepter_user_id', current_user_id,
      'timestamp', now()
    ));
  
  RETURN jsonb_build_object('success', true, 'message', 'Friend request accepted');
END;
$$;

-- Create function to reject friend requests
CREATE OR REPLACE FUNCTION public.reject_friend_request(requester_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  existing_request record;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
  END IF;
  
  -- Check if there's a friend request from requester to current user
  SELECT * INTO existing_request
  FROM user_connections
  WHERE user_id = requester_user_id 
    AND connected_user_id = current_user_id 
    AND connection_type = 'friend_request';
  
  IF existing_request.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Friend request not found');
  END IF;
  
  -- Delete the friend request
  DELETE FROM user_connections WHERE id = existing_request.id;
  
  -- Log the rejection
  PERFORM log_security_event('friend_request_rejected', 'user_connections', existing_request.id, 
    jsonb_build_object(
      'requester_user_id', requester_user_id,
      'rejecter_user_id', current_user_id,
      'timestamp', now()
    ));
  
  RETURN jsonb_build_object('success', true, 'message', 'Friend request rejected');
END;
$$;

COMMENT ON FUNCTION public.accept_friend_request IS 'Accepts a friend request and creates reciprocal friend connections';
COMMENT ON FUNCTION public.reject_friend_request IS 'Rejects and deletes a friend request';