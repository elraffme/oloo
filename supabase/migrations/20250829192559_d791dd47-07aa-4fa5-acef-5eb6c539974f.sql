-- Add policy to allow users to view public profile information of other users
CREATE POLICY "Users can view public profile information of others" 
ON public.profiles 
FOR SELECT 
USING (
  -- Allow viewing public information of other verified, non-demo profiles
  auth.uid() IS NOT NULL 
  AND user_id != auth.uid() 
  AND verified = true 
  AND is_demo_profile = false
);

-- Add policy to allow users to view demo profiles for discovery
CREATE POLICY "Users can view demo profiles for discovery" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_demo_profile = true
);

-- Add main_profile_photo_index column to track which photo is the main one
ALTER TABLE public.profiles 
ADD COLUMN main_profile_photo_index integer DEFAULT 0;

-- Add comment to explain the column
COMMENT ON COLUMN public.profiles.main_profile_photo_index IS 'Index of the main profile photo in the profile_photos array (0-based)';

-- Create index for better performance when querying public profiles
CREATE INDEX idx_profiles_public_view ON public.profiles(verified, is_demo_profile, user_id) 
WHERE verified = true AND is_demo_profile = false;