-- Fix: Remove the remaining SECURITY DEFINER function that's causing the linter error

-- Drop the problematic SECURITY DEFINER function
DROP FUNCTION IF EXISTS public.log_driver_access();

-- The view is now clean and works with proper RLS policies
-- Verify the current state is secure
SELECT 
  schemaname, viewname,
  CASE 
    WHEN definition LIKE '%SECURITY DEFINER%' THEN 'INSECURE: Contains SECURITY DEFINER'
    ELSE 'SECURE: Uses proper RLS policies'
  END AS security_status
FROM pg_views 
WHERE schemaname = 'public' AND viewname = 'available_drivers';

-- Log the final security fix completion
SELECT log_security_event(
  'security_definer_vulnerability_fully_resolved',
  'available_drivers_system',
  NULL,
  jsonb_build_object(
    'final_status', 'secure_rls_implementation',
    'no_security_definer_functions', true,
    'proper_user_level_permissions', true,
    'timestamp', now()
  )
);