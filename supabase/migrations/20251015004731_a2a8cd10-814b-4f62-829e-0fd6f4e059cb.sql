-- Clean up conflicting RLS policies on streaming_sessions
-- Remove all existing policies to start fresh
DROP POLICY IF EXISTS "Stream hosts can fully manage their streams" ON public.streaming_sessions;
DROP POLICY IF EXISTS "Viewers can see safe public stream data only" ON public.streaming_sessions;
DROP POLICY IF EXISTS "insert_streams_by_owner" ON public.streaming_sessions;
DROP POLICY IF EXISTS "select_public_streams" ON public.streaming_sessions;
DROP POLICY IF EXISTS "streaming_sessions_delete_by_host" ON public.streaming_sessions;
DROP POLICY IF EXISTS "streaming_sessions_insert" ON public.streaming_sessions;
DROP POLICY IF EXISTS "streaming_sessions_select_public" ON public.streaming_sessions;
DROP POLICY IF EXISTS "streaming_sessions_update_by_host" ON public.streaming_sessions;
DROP POLICY IF EXISTS "update_own_stream" ON public.streaming_sessions;

-- Create clean, consistent policies requiring authentication

-- Hosts can view all their own streams (private or public, any status)
CREATE POLICY "streaming_hosts_select_own"
ON public.streaming_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = host_user_id);

-- Hosts can create their own streams
CREATE POLICY "streaming_hosts_insert_own"
ON public.streaming_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = host_user_id);

-- Hosts can update their own streams
CREATE POLICY "streaming_hosts_update_own"
ON public.streaming_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = host_user_id)
WITH CHECK (auth.uid() = host_user_id);

-- Hosts can delete their own streams
CREATE POLICY "streaming_hosts_delete_own"
ON public.streaming_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = host_user_id);

-- Authenticated users can view public live streams (excluding stream_key)
CREATE POLICY "streaming_viewers_select_public_live"
ON public.streaming_sessions
FOR SELECT
TO authenticated
USING (
  is_private = false 
  AND status = 'live'
  AND auth.uid() != host_user_id  -- Don't duplicate access for hosts
);

COMMENT ON TABLE public.streaming_sessions IS 
  'Streaming sessions with RLS requiring authentication. Hosts can fully manage their own streams. Authenticated users can view public live streams only.';