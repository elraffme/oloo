-- Fix Security Definer functions by removing SECURITY DEFINER where not necessary

-- Replace get_available_drivers_safe with a regular function
-- The function had proper security but linter flags SECURITY DEFINER as risky
DROP FUNCTION IF EXISTS public.get_available_drivers_safe();

-- Create a regular function that relies on RLS policies instead of SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_available_drivers_safe()
RETURNS TABLE(
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
SET search_path TO 'public'
AS $$
BEGIN
  -- Only authenticated users can call this function
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Log the access attempt (using a non-SECURITY DEFINER logging approach)
  INSERT INTO public.security_audit_log (
    user_id, action, resource_type, details
  ) VALUES (
    auth.uid(),
    'available_drivers_accessed',
    'drivers',
    jsonb_build_object(
      'accessed_by', auth.uid(),
      'access_method', 'regular_function',
      'timestamp', now()
    )
  );
  
  -- Return only safe driver information
  -- This relies on RLS policies on the underlying tables
  RETURN QUERY
  SELECT 
    d.id,
    d.vehicle_make,
    d.vehicle_model,
    d.vehicle_color,
    d.vehicle_year,
    d.rating,
    d.total_rides,
    -- Only expose general location area, not precise coordinates
    CASE 
      WHEN d.current_location IS NOT NULL THEN 
        jsonb_build_object(
          'area', 'Available nearby',
          'eta_minutes', (random() * 10 + 2)::integer
        )
      ELSE NULL
    END as location_info,
    p.display_name,
    p.avatar_url
  FROM public.drivers d
  LEFT JOIN public.profiles p ON d.user_id = p.user_id
  WHERE d.is_available = true;
END;
$$;

-- Update handle_new_driver to remove SECURITY DEFINER as it's just a simple trigger
DROP FUNCTION IF EXISTS public.handle_new_driver();

CREATE OR REPLACE FUNCTION public.handle_new_driver()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- This will be called when someone updates their profile to indicate they're a driver
  RETURN NEW;
END;
$$;

-- Grant execute permissions to authenticated users for the safe function
GRANT EXECUTE ON FUNCTION public.get_available_drivers_safe() TO authenticated;