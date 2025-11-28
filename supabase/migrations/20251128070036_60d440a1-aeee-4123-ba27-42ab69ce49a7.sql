-- Add RLS policy for authenticated users to view public live streams
CREATE POLICY "authenticated_users_can_see_public_live_streams"
ON public.streaming_sessions
FOR SELECT
TO authenticated
USING ((is_private = false) AND (status = 'live'));

-- Add RLS policy for authenticated users to view archived/ended streams
CREATE POLICY "authenticated_users_can_see_archived_streams"
ON public.streaming_sessions
FOR SELECT
TO authenticated
USING ((is_private = false) AND (status IN ('ended', 'archived')));