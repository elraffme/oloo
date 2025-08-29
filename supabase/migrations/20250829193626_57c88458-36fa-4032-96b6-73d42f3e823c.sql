-- Fix security vulnerability in messages table RLS policies
-- The current SELECT policy allows senders to read messages regardless of match status
-- This fix ensures both sender and receiver must be part of a mutual match

-- Drop the existing vulnerable SELECT policy
DROP POLICY IF EXISTS "Users can view messages from matches only" ON public.messages;

-- Create a secure SELECT policy that requires mutual match for both sender and receiver
CREATE POLICY "Users can view messages only within mutual matches" 
ON public.messages 
FOR SELECT 
USING (
  (auth.uid() = sender_id OR auth.uid() = receiver_id) 
  AND check_mutual_match(sender_id, receiver_id)
);

-- Also update the INSERT policy to be more explicit about the mutual match requirement
DROP POLICY IF EXISTS "Users can send messages to matches only" ON public.messages;

CREATE POLICY "Users can send messages to mutual matches only" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id 
  AND check_mutual_match(sender_id, receiver_id)
  AND sender_id != receiver_id  -- Prevent self-messaging
);

-- Keep the UPDATE policy as is, it's already secure
-- "Users can update read status on their received messages" is fine