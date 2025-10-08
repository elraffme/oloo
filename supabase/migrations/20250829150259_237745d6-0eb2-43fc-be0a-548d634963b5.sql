-- Add match tracking to user_connections table
-- First, let's add a proper constraint to prevent duplicate connections
ALTER TABLE user_connections ADD CONSTRAINT unique_user_connection 
UNIQUE (user_id, connected_user_id);

-- Create a function to check for mutual matches
CREATE OR REPLACE FUNCTION check_mutual_match(user1_id uuid, user2_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if both users have liked each other
  RETURN EXISTS (
    SELECT 1 FROM user_connections 
    WHERE user_id = user1_id AND connected_user_id = user2_id AND connection_type = 'like'
  ) AND EXISTS (
    SELECT 1 FROM user_connections 
    WHERE user_id = user2_id AND connected_user_id = user1_id AND connection_type = 'like'
  );
END;
$$;

-- Create a function to get user's matches
CREATE OR REPLACE FUNCTION get_user_matches(target_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  match_user_id uuid,
  display_name text,
  avatar_url text,
  profile_photos text[],
  match_created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only allow users to get their own matches
  IF target_user_id != auth.uid() THEN
    RETURN;
  END IF;
  
  -- Return users who have mutual likes
  RETURN QUERY
  SELECT 
    p.user_id,
    p.display_name,
    p.avatar_url,
    p.profile_photos,
    GREATEST(uc1.created_at, uc2.created_at) as match_created_at
  FROM user_connections uc1
  JOIN user_connections uc2 ON 
    uc1.user_id = target_user_id AND 
    uc1.connected_user_id = uc2.user_id AND
    uc2.user_id = uc1.connected_user_id AND 
    uc2.connected_user_id = target_user_id
  JOIN profiles p ON p.user_id = uc1.connected_user_id
  WHERE 
    uc1.connection_type = 'like' AND 
    uc2.connection_type = 'like'
  ORDER BY GREATEST(uc1.created_at, uc2.created_at) DESC;
END;
$$;

-- Update RLS policy for messages to only allow messaging between matches
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
CREATE POLICY "Users can view messages from matches only" 
ON messages FOR SELECT 
USING (
  auth.uid() = sender_id OR 
  (auth.uid() = receiver_id AND check_mutual_match(sender_id, receiver_id))
);

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages to matches only" 
ON messages FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id AND 
  check_mutual_match(sender_id, receiver_id)
);

-- Update messages table to mark read status properly
CREATE POLICY "Users can update read status on their received messages" 
ON messages FOR UPDATE 
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);