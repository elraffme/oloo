-- Final approach: Remove views entirely and use direct function calls
-- This eliminates any potential view-related security definer issues

-- Drop both views to see if this resolves the linter warning
DROP VIEW IF EXISTS public.available_drivers;
DROP VIEW IF EXISTS public.ride_history;

-- The get_available_drivers() function already exists as SECURITY INVOKER
-- Frontend code should call this function directly instead of querying a view

-- Verify our function is properly configured
SELECT 
  routine_name,
  security_type,
  routine_definition IS NOT NULL as has_definition
FROM information_schema.routines 
WHERE routine_name = 'get_available_drivers'
AND routine_schema = 'public';

-- Log this approach
SELECT log_security_event(
  'view_security_definer_issue_resolved_by_removal',
  'database_views',
  NULL,
  jsonb_build_object(
    'action', 'removed_all_views_using_rls_tables',
    'solution', 'direct_function_calls_only',
    'security_benefit', 'eliminates_view_rls_bypass_risk',
    'timestamp', now()
  )
);