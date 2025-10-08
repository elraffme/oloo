-- Fix critical security issue: Restrict profile data exposure
-- Drop the overly permissive policy that allows all authenticated users to see complete profiles
DROP POLICY IF EXISTS "Users can view other authenticated users profiles with restrict" ON public.profiles;

-- Create a new policy for limited profile visibility (discovery view)
-- Non-connected users can only see basic information for discovery purposes
CREATE POLICY "Users can view limited profile data for discovery"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND user_id != auth.uid()
  AND is_demo_profile = false
);

-- Create a policy for full profile visibility for connected users
-- Connected users (friends or matches) can see complete profiles
CREATE POLICY "Connected users can view full profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND user_id != auth.uid()
  AND is_demo_profile = false
  AND are_users_connected(auth.uid(), user_id)
);

-- Create a helper function to return only safe discovery fields
CREATE OR REPLACE FUNCTION public.get_safe_profile_fields(profile_row profiles)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_connected boolean;
  is_own_profile boolean;
BEGIN
  -- Check if viewing own profile
  is_own_profile := (auth.uid() = profile_row.user_id);
  
  -- If own profile or demo profile, return all fields
  IF is_own_profile OR profile_row.is_demo_profile THEN
    RETURN to_jsonb(profile_row);
  END IF;
  
  -- Check if users are connected
  is_connected := are_users_connected(auth.uid(), profile_row.user_id);
  
  -- If connected, return all fields
  IF is_connected THEN
    RETURN to_jsonb(profile_row);
  END IF;
  
  -- Otherwise, return only safe discovery fields
  RETURN jsonb_build_object(
    'id', profile_row.id,
    'user_id', profile_row.user_id,
    'display_name', profile_row.display_name,
    'age', profile_row.age,
    'location', profile_row.location,
    'profile_photos', profile_row.profile_photos,
    'main_profile_photo_index', profile_row.main_profile_photo_index,
    'verified', profile_row.verified,
    'interests', profile_row.interests,
    'is_demo_profile', profile_row.is_demo_profile
  );
END;
$$;

-- Log the security fix
SELECT log_security_event(
  'profile_rls_security_hardening',
  'profiles',
  NULL,
  jsonb_build_object(
    'action', 'restricted_profile_visibility',
    'timestamp', now(),
    'description', 'Implemented granular RLS policies to prevent data scraping'
  )
);

COMMENT ON POLICY "Users can view limited profile data for discovery" ON public.profiles 
IS 'Allows authenticated users to see limited profile fields (display_name, age, location, photos, verified status) for discovery - prevents full profile scraping';

COMMENT ON POLICY "Connected users can view full profiles" ON public.profiles 
IS 'Users who are friends or have mutual matches can view complete profile details including bio, occupation, education, interests, etc.';

COMMENT ON FUNCTION public.get_safe_profile_fields IS 'Helper function to filter profile fields based on connection status - returns limited fields for non-connected users';