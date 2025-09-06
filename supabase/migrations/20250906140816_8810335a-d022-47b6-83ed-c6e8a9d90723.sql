-- Add friend request functionality to user_connections
-- The existing connection_type enum already supports different types
-- We'll add 'friend_request' and 'friend' as new connection types

-- First create a function to handle friend requests
CREATE OR REPLACE FUNCTION public.send_friend_request(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_user_id uuid;
  existing_connection record;
  result jsonb;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if user is trying to add themselves
  IF current_user_id = target_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot add yourself as friend');
  END IF;
  
  -- Check if there's already a connection between these users
  SELECT * INTO existing_connection
  FROM user_connections
  WHERE (user_id = current_user_id AND connected_user_id = target_user_id)
     OR (user_id = target_user_id AND connected_user_id = current_user_id);
  
  -- If already friends
  IF existing_connection.connection_type = 'friend' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Already friends');
  END IF;
  
  -- If friend request already sent
  IF existing_connection.connection_type = 'friend_request' THEN
    -- Check if the existing request is from current user to target
    IF existing_connection.user_id = current_user_id THEN
      RETURN jsonb_build_object('success', false, 'message', 'Friend request already sent');
    ELSE
      -- The target user had already sent a request to current user, so accept it
      UPDATE user_connections 
      SET connection_type = 'friend', updated_at = now()
      WHERE id = existing_connection.id;
      
      -- Create the reciprocal friend connection
      INSERT INTO user_connections (user_id, connected_user_id, connection_type)
      VALUES (current_user_id, target_user_id, 'friend');
      
      RETURN jsonb_build_object('success', true, 'message', 'Friend request accepted', 'type', 'accepted');
    END IF;
  END IF;
  
  -- Send new friend request
  INSERT INTO user_connections (user_id, connected_user_id, connection_type)
  VALUES (current_user_id, target_user_id, 'friend_request');
  
  RETURN jsonb_build_object('success', true, 'message', 'Friend request sent', 'type', 'sent');
END;
$$;

-- Function to accept friend request
CREATE OR REPLACE FUNCTION public.accept_friend_request(requester_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Update the friend request to friend
  UPDATE user_connections 
  SET connection_type = 'friend', updated_at = now()
  WHERE user_id = requester_user_id AND connected_user_id = current_user_id AND connection_type = 'friend_request';
  
  -- Create reciprocal friend connection
  INSERT INTO user_connections (user_id, connected_user_id, connection_type)
  VALUES (current_user_id, requester_user_id, 'friend')
  ON CONFLICT (user_id, connected_user_id) 
  DO UPDATE SET connection_type = 'friend', updated_at = now();
  
  RETURN jsonb_build_object('success', true, 'message', 'Friend request accepted');
END;
$$;

-- Function to get user's friends
CREATE OR REPLACE FUNCTION public.get_user_friends(target_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  friend_user_id uuid, 
  display_name text, 
  avatar_url text, 
  profile_photos text[], 
  friend_since timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only allow users to get their own friends
  IF target_user_id != auth.uid() THEN
    RETURN;
  END IF;
  
  -- Return users who are friends
  RETURN QUERY
  SELECT 
    p.user_id,
    p.display_name,
    p.avatar_url,
    p.profile_photos,
    uc.created_at as friend_since
  FROM user_connections uc
  JOIN profiles p ON p.user_id = uc.connected_user_id
  WHERE uc.user_id = target_user_id 
    AND uc.connection_type = 'friend'
  ORDER BY uc.created_at DESC;
END;
$$;

-- Function to get friend requests
CREATE OR REPLACE FUNCTION public.get_friend_requests(target_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  requester_user_id uuid, 
  display_name text, 
  avatar_url text, 
  profile_photos text[], 
  request_date timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only allow users to get their own friend requests
  IF target_user_id != auth.uid() THEN
    RETURN;
  END IF;
  
  -- Return pending friend requests
  RETURN QUERY
  SELECT 
    p.user_id,
    p.display_name,
    p.avatar_url,
    p.profile_photos,
    uc.created_at as request_date
  FROM user_connections uc
  JOIN profiles p ON p.user_id = uc.user_id
  WHERE uc.connected_user_id = target_user_id 
    AND uc.connection_type = 'friend_request'
  ORDER BY uc.created_at DESC;
END;
$$;