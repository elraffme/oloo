-- Update the check constraint to allow friend-related connection types
ALTER TABLE public.user_connections 
DROP CONSTRAINT user_connections_connection_type_check;

-- Add the updated constraint that includes friend types
ALTER TABLE public.user_connections 
ADD CONSTRAINT user_connections_connection_type_check 
CHECK (connection_type = ANY (ARRAY['like'::text, 'match'::text, 'block'::text, 'report'::text, 'friend_request'::text, 'friend'::text]));