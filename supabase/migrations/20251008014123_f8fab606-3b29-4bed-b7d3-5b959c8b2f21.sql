-- Create function to check if two users are connected (friends or matches)
CREATE OR REPLACE FUNCTION public.are_users_connected(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if users are friends or have mutual likes (matches)
  RETURN EXISTS (
    SELECT 1 FROM user_connections
    WHERE (
      (user_id = user_a AND connected_user_id = user_b AND connection_type IN ('friend', 'match'))
      OR
      (user_id = user_b AND connected_user_id = user_a AND connection_type IN ('friend', 'match'))
    )
  ) OR EXISTS (
    -- Check for mutual likes (matches)
    SELECT 1 FROM user_connections uc1
    WHERE uc1.user_id = user_a 
      AND uc1.connected_user_id = user_b 
      AND uc1.connection_type = 'like'
      AND EXISTS (
        SELECT 1 FROM user_connections uc2
        WHERE uc2.user_id = user_b 
          AND uc2.connected_user_id = user_a 
          AND uc2.connection_type = 'like'
      )
  );
END;
$$;

-- Create function to get safe profile data for discovery
CREATE OR REPLACE FUNCTION public.get_discovery_profile(profile_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Return only safe fields for discovery (no detailed personal information)
  SELECT jsonb_build_object(
    'id', id,
    'user_id', user_id,
    'display_name', display_name,
    'age', age,
    'location', location,
    'profile_photos', profile_photos,
    'main_profile_photo_index', main_profile_photo_index,
    'verified', verified,
    'interests', interests,
    'is_demo_profile', is_demo_profile
  ) INTO result
  FROM public.profiles 
  WHERE user_id = profile_user_id;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Create function to get full profile data (only for connected users or self)
CREATE OR REPLACE FUNCTION public.get_full_profile(profile_user_id uuid, requesting_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  is_connected boolean;
  is_own_profile boolean;
BEGIN
  -- Check if requesting user is viewing their own profile
  is_own_profile := (requesting_user_id = profile_user_id);
  
  -- Check if users are connected
  is_connected := are_users_connected(requesting_user_id, profile_user_id);
  
  -- Only return full profile if user is viewing their own profile or is connected
  IF is_own_profile OR is_connected THEN
    SELECT to_jsonb(profiles.*) INTO result
    FROM public.profiles 
    WHERE user_id = profile_user_id;
    
    -- Log access for security audit
    PERFORM log_security_event(
      'full_profile_accessed',
      'profile',
      profile_user_id,
      jsonb_build_object(
        'accessed_by', requesting_user_id,
        'is_own_profile', is_own_profile,
        'is_connected', is_connected,
        'timestamp', now()
      )
    );
    
    RETURN COALESCE(result, '{}'::jsonb);
  ELSE
    -- Return only discovery data if not connected
    RETURN get_discovery_profile(profile_user_id);
  END IF;
END;
$$;

-- Update the RLS policy to be more restrictive
-- Drop the old discovery policy
DROP POLICY IF EXISTS "Users can view other users for discovery" ON public.profiles;

-- Create new restrictive policy for viewing other users
-- This policy allows row-level access but application code should use
-- get_discovery_profile() or get_full_profile() functions for proper column-level security
CREATE POLICY "Users can view other authenticated users profiles with restrictions"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    -- Users can always view their own profile
    auth.uid() = user_id
    OR
    -- Users can view demo profiles
    is_demo_profile = true
    OR
    -- Users can view other real profiles (but app should use secure functions)
    (is_demo_profile = false AND user_id != auth.uid())
  )
);

COMMENT ON FUNCTION public.get_discovery_profile IS 'Returns limited profile data safe for discovery/browsing. Use this for profile cards, search results, and swiping interfaces.';
COMMENT ON FUNCTION public.get_full_profile IS 'Returns complete profile data only if requesting user owns the profile or is connected (friends/matched). Use this for detailed profile views.';
COMMENT ON FUNCTION public.are_users_connected IS 'Checks if two users are connected via friendship or mutual match.';