-- Create the accept_friend_request RPC function that's missing
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
  
  -- Validate user is authenticated
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
  END IF;
  
  -- Check if user is trying to accept their own request
  IF current_user_id = requester_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot accept your own request');
  END IF;
  
  -- Find the friend request
  SELECT * INTO existing_request
  FROM user_connections
  WHERE user_id = requester_user_id 
    AND connected_user_id = current_user_id 
    AND connection_type = 'friend_request';
  
  -- Check if the friend request exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Friend request not found');
  END IF;
  
  -- Update the existing request to 'friend'
  UPDATE user_connections 
  SET connection_type = 'friend', updated_at = now()
  WHERE id = existing_request.id;
  
  -- Create the reciprocal friend connection
  INSERT INTO user_connections (user_id, connected_user_id, connection_type)
  VALUES (current_user_id, requester_user_id, 'friend')
  ON CONFLICT (user_id, connected_user_id) 
  DO UPDATE SET connection_type = 'friend', updated_at = now();
  
  -- Log the acceptance for security audit
  PERFORM log_security_event('friend_request_accepted', 'user_connections', existing_request.id, 
    jsonb_build_object(
      'requester_id', requester_user_id,
      'accepter_id', current_user_id,
      'timestamp', now()
    ));
  
  RETURN jsonb_build_object('success', true, 'message', 'Friend request accepted');
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    PERFORM log_security_event('friend_request_accept_error', 'user_connections', NULL, 
      jsonb_build_object(
        'requester_id', requester_user_id,
        'accepter_id', current_user_id,
        'error', SQLERRM,
        'timestamp', now()
      ));
    
    RETURN jsonb_build_object('success', false, 'message', 'Failed to accept friend request');
END;
$$;

-- Also create reject_friend_request function for completeness
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
  
  -- Validate user is authenticated
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
  END IF;
  
  -- Find and delete the friend request
  DELETE FROM user_connections
  WHERE user_id = requester_user_id 
    AND connected_user_id = current_user_id 
    AND connection_type = 'friend_request'
  RETURNING * INTO existing_request;
  
  -- Check if the friend request existed
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Friend request not found');
  END IF;
  
  -- Log the rejection for security audit
  PERFORM log_security_event('friend_request_rejected', 'user_connections', existing_request.id, 
    jsonb_build_object(
      'requester_id', requester_user_id,
      'rejecter_id', current_user_id,
      'timestamp', now()
    ));
  
  RETURN jsonb_build_object('success', true, 'message', 'Friend request rejected');
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Failed to reject friend request');
END;
$$;