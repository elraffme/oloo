-- Add onboarding_completed field to existing profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Update existing profiles that have complete data to mark onboarding as completed
UPDATE public.profiles 
SET onboarding_completed = true 
WHERE display_name IS NOT NULL 
  AND age IS NOT NULL 
  AND location IS NOT NULL 
  AND bio IS NOT NULL;