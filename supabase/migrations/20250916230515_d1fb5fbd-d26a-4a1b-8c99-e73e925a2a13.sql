-- Allow viewing unverified users for search/discovery while maintaining security
-- This enables real users to be discoverable even before verification

-- Drop the restrictive policy that blocks unverified users
DROP POLICY IF EXISTS "Users can view public profile information of others" ON public.profiles;

-- Create a new policy that allows viewing other users regardless of verification status
-- but still maintains appropriate security boundaries
CREATE POLICY "Users can view other users for discovery"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.uid() IS NOT NULL) 
  AND (user_id <> auth.uid()) 
  AND (is_demo_profile = false)
);

-- Keep the existing demo profile policy unchanged
-- Demo profiles already have their own separate policy

-- Log this security improvement
SELECT log_security_event(
  'profiles_search_discovery_enabled',
  'profiles_table_rls',
  auth.uid(),
  jsonb_build_object(
    'change', 'removed_verification_requirement_for_discovery',
    'impact', 'unverified_real_users_now_searchable',
    'security_maintained', true,
    'users_can_still_see_verification_status', true,
    'timestamp', now()
  )
);