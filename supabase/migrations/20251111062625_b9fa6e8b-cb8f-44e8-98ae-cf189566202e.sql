-- Drop the old restrictive policy that excluded hosts from seeing their own streams
DROP POLICY IF EXISTS "streaming_viewers_select_public_live" ON streaming_sessions;

-- Create new policy that allows all authenticated users to see public live streams
CREATE POLICY "viewers_can_see_all_public_live_streams"
ON streaming_sessions
FOR SELECT
USING (
  is_private = false 
  AND status = 'live'
  AND auth.uid() IS NOT NULL
);