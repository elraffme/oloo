-- Fix Security Definer View issue by setting security_invoker = true on views
-- This makes views execute with the privileges of the invoking user rather than the creator

-- Set security_invoker = true for available_drivers view
ALTER VIEW public.available_drivers SET (security_invoker = true);

-- Set security_invoker = true for ride_history view  
ALTER VIEW public.ride_history SET (security_invoker = true);

-- Verify that RLS policies are properly configured on underlying tables
-- The views will now inherit security from the invoking user via RLS policies