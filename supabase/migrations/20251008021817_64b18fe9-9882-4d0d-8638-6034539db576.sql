-- Drop and recreate the accept_friend_request function with better error handling
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
  -- Get current authenticated user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Authentication required',
      'debug', 'No auth.uid() found'
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
      'message', 'Friend request not found',
      'debug', jsonb_build_object(
        'requester_id', requester_user_id,
        'current_user', current_user_id
      )
    );
  END IF;
  
  -- Update the request to friend status (from requester to current user)
  UPDATE user_connections 
  SET connection_type = 'friend', updated_at = now()
  WHERE id = request_id;
  
  -- Create reciprocal friend connection (from current user to requester)
  INSERT INTO user_connections (user_id, connected_user_id, connection_type)
  VALUES (current_user_id, requester_user_id, 'friend')
  ON CONFLICT (user_id, connected_user_id) 
  DO UPDATE SET connection_type = 'friend', updated_at = now();
  
  -- Log the acceptance for security audit
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
    'message', 'Error accepting friend request',
    'error', SQLERRM
  );
END;
$$;

-- Drop and recreate the reject_friend_request function with better error handling
DROP FUNCTION IF EXISTS public.reject_friend_request(uuid);

CREATE OR REPLACE FUNCTION public.reject_friend_request(requester_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  request_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Authentication required'
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
  
  -- Delete the friend request
  DELETE FROM user_connections WHERE id = request_id;
  
  -- Log the rejection
  PERFORM log_security_event(
    'friend_request_rejected', 
    'user_connections', 
    request_id, 
    jsonb_build_object(
      'requester_user_id', requester_user_id,
      'rejecter_user_id', current_user_id,
      'timestamp', now()
    )
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Friend request rejected',
    'type', 'rejected'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false, 
    'message', 'Error rejecting friend request',
    'error', SQLERRM
  );
END;
$$;

-- Add unique constraint to prevent duplicate connections
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_connections_unique 
ON user_connections (user_id, connected_user_id);

COMMENT ON FUNCTION public.accept_friend_request IS 'Accepts a friend request and creates reciprocal friend connections with improved error handling';
COMMENT ON FUNCTION public.reject_friend_request IS 'Rejects and deletes a friend request with improved error handling';