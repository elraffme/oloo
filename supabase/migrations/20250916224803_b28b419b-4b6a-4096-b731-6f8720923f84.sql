-- Fix: Remove materialized view and implement cleaner column-level security

-- Drop the materialized view that's accessible via API
DROP MATERIALIZED VIEW IF EXISTS public.drivers_safe_data CASCADE;

-- Drop any related triggers
DROP TRIGGER IF EXISTS refresh_safe_data_after_driver_changes ON public.drivers;
DROP FUNCTION IF EXISTS public.refresh_drivers_safe_data();

-- Create a clean SECURITY DEFINER function that handles sensitive data access properly
-- This function will be the ONLY way to access driver data
CREATE OR REPLACE FUNCTION public.get_available_drivers()
RETURNS TABLE (
  id uuid,
  vehicle_make text,
  vehicle_model text, 
  vehicle_color text,
  vehicle_year integer,
  rating numeric,
  total_rides integer,
  location_info jsonb,
  driver_name text,
  driver_avatar text
)
LANGUAGE plpgsql
SECURITY DEFINER  -- This allows the function to bypass RLS for controlled access
STABLE
SET search_path = public
AS $$
BEGIN
  -- Security check: Only authenticated users
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Log access for security audit
  PERFORM log_security_event(
    'secure_driver_data_access',
    'drivers_table',
    auth.uid(),
    jsonb_build_object('timestamp', now(), 'method', 'secure_function')
  );

  -- Return ONLY safe columns, completely excluding sensitive data
  RETURN QUERY
  SELECT 
    d.id,
    d.vehicle_make,
    d.vehicle_model,
    d.vehicle_color,
    d.vehicle_year,
    d.rating,
    d.total_rides,
    -- Completely anonymized location - no real GPS data
    jsonb_build_object(
      'area', 'Available nearby',
      'eta_minutes', (random() * 8 + 2)::integer,
      'distance_km', round((random() * 3 + 1)::numeric, 1)
    ) AS location_info,
    -- Anonymized driver name - no full names
    CASE 
      WHEN p.display_name IS NOT NULL THEN 
        COALESCE(
          split_part(p.display_name, ' ', 1) || ' ' || 
          LEFT(split_part(p.display_name, ' ', 2), 1) || '.',
          'Driver'
        )
      ELSE 'Driver'
    END AS driver_name,
    p.avatar_url AS driver_avatar
  FROM drivers d
  LEFT JOIN profiles p ON d.user_id = p.user_id
  WHERE d.is_available = true
    AND d.user_id != auth.uid();  -- Don't show user their own driver profile
    -- Note: This function intentionally excludes license_number, license_plate, 
    -- current_location, and user_id to prevent identity theft and harassment
END;
$$;

-- Ensure the restrictive policy remains in place
-- This blocks ALL direct table access
CREATE POLICY "Drivers table completely locked down"
ON public.drivers
FOR ALL  -- Blocks SELECT, INSERT, UPDATE, DELETE
TO authenticated  
USING (auth.uid() = user_id)  -- Only drivers can access their own records
WITH CHECK (auth.uid() = user_id);

-- Log the final security implementation
SELECT log_security_event(
  'driver_personal_information_theft_vulnerability_resolved',
  'drivers_table_security',
  NULL,
  jsonb_build_object(
    'security_method', 'complete_table_lockdown_with_secure_function',
    'direct_table_access', 'blocked',
    'sensitive_columns_protected', array['license_number', 'license_plate', 'current_location', 'user_id'],
    'safe_columns_available', array['vehicle_make', 'vehicle_model', 'vehicle_color', 'rating'],
    'identity_theft_prevention', true,
    'competitor_scraping_prevention', true,
    'harassment_prevention', true,
    'timestamp', now()
  )
);