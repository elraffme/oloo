-- Update messages table RLS policies to support friends messaging
-- Also add a function to check if users are friends or have mutual match

CREATE OR REPLACE FUNCTION public.check_user_can_message(sender_uuid uuid, receiver_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if users are friends (bidirectional check)
  IF EXISTS (
    SELECT 1 FROM user_connections 
    WHERE ((user_id = sender_uuid AND connected_user_id = receiver_uuid) 
           OR (user_id = receiver_uuid AND connected_user_id = sender_uuid))
      AND connection_type = 'friend'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if users have mutual match (existing functionality)
  IF check_mutual_match(sender_uuid, receiver_uuid) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Update the messages INSERT policy to use the new function
DROP POLICY IF EXISTS "Users can send messages to mutual matches only" ON public.messages;

CREATE POLICY "Users can send messages to friends and matches only" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id 
  AND check_user_can_message(sender_id, receiver_id) 
  AND sender_id <> receiver_id
);

-- Update the messages SELECT policy to use the new function
DROP POLICY IF EXISTS "Users can view messages only within mutual matches" ON public.messages;

CREATE POLICY "Users can view messages with friends and matches only" 
ON public.messages 
FOR SELECT 
USING (
  ((auth.uid() = sender_id) OR (auth.uid() = receiver_id)) 
  AND check_user_can_message(sender_id, receiver_id)
);