-- Fix the accept_friend_request function - remove updated_at references
DROP FUNCTION IF EXISTS public.accept_friend_request(uuid);

CREATE OR REPLACE FUNCTION public.accept_friend_request(requester_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  request_id uuid;
  already_friends boolean;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Authentication required'
    );
  END IF;
  
  -- Check if already friends
  SELECT EXISTS (
    SELECT 1 FROM user_connections
    WHERE ((user_id = current_user_id AND connected_user_id = requester_user_id)
       OR (user_id = requester_user_id AND connected_user_id = current_user_id))
      AND connection_type = 'friend'
  ) INTO already_friends;
  
  IF already_friends THEN
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Already friends',
      'type', 'already_friends'
    );
  END IF;
  
  -- Find the friend request
  SELECT id INTO request_id
  FROM user_connections
  WHERE user_id = requester_user_id 
    AND connected_user_id = current_user_id 
    AND connection_type = 'friend_request'
  LIMIT 1;
  
  IF request_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Friend request not found'
    );
  END IF;
  
  -- Update the request to friend status
  UPDATE user_connections 
  SET connection_type = 'friend'
  WHERE id = request_id;
  
  -- Create reciprocal friend connection
  INSERT INTO user_connections (user_id, connected_user_id, connection_type)
  VALUES (current_user_id, requester_user_id, 'friend')
  ON CONFLICT (user_id, connected_user_id) 
  DO UPDATE SET connection_type = 'friend';
  
  -- Log the acceptance
  PERFORM log_security_event(
    'friend_request_accepted', 
    'user_connections', 
    request_id, 
    jsonb_build_object(
      'requester_user_id', requester_user_id,
      'accepter_user_id', current_user_id,
      'timestamp', now()
    )
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Friend request accepted',
    'type', 'accepted'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false, 
    'message', 'Error: ' || SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION public.accept_friend_request IS 'Accepts a friend request and creates reciprocal friend connections';