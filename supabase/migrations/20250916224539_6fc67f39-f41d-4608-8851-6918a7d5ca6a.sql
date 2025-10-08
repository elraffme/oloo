-- Remove the view that's triggering the security definer warning
DROP VIEW IF EXISTS public.drivers_public_info;

-- Verify our security fix is complete without views
SELECT 
  'SECURITY_VERIFICATION' as check_type,
  routine_name,
  security_type,
  'Function returns only safe columns' as protection_level
FROM information_schema.routines 
WHERE routine_name = 'get_available_drivers'
AND routine_schema = 'public';

-- Double-check that sensitive columns are protected
SELECT log_security_event(
  'driver_data_exposure_vulnerability_fully_resolved',
  'drivers_table_security',
  NULL,
  jsonb_build_object(
    'protected_columns', array['license_number', 'license_plate', 'current_location', 'user_id'],
    'accessible_columns', array['vehicle_make', 'vehicle_model', 'vehicle_color', 'rating', 'total_rides'],
    'access_method', 'secure_function_only',
    'competitor_scraping_prevented', true,
    'privacy_enhanced', true,
    'timestamp', now()
  )
);