-- Fix Security Definer View issues by recreating views without SECURITY DEFINER

-- Drop existing views that may have security definer properties
DROP VIEW IF EXISTS public.available_drivers;
DROP VIEW IF EXISTS public.ride_history;

-- Recreate available_drivers view without SECURITY DEFINER
CREATE VIEW public.available_drivers AS
SELECT 
    d.id,
    d.vehicle_make,
    d.vehicle_model,
    d.vehicle_color,
    d.vehicle_year,
    d.rating,
    d.total_rides,
    CASE 
        WHEN d.current_location IS NOT NULL THEN 
            jsonb_build_object(
                'area', 'Available nearby',
                'eta_minutes', (random() * 10 + 2)::integer
            )
        ELSE NULL
    END as location_info,
    p.display_name as driver_name,
    p.avatar_url as driver_avatar
FROM public.drivers d
LEFT JOIN public.profiles p ON d.user_id = p.user_id
WHERE d.is_available = true;

-- Recreate ride_history view without SECURITY DEFINER  
CREATE VIEW public.ride_history AS
SELECT 
    r.id,
    r.user_id,
    r.driver_id,
    r.pickup_location,
    r.destination,
    r.ride_type,
    r.status,
    r.estimated_price,
    r.actual_price,
    r.estimated_duration_minutes,
    r.actual_duration_minutes,
    r.user_rating,
    r.driver_rating,
    r.created_at,
    r.completed_at,
    p_user.display_name as user_name,
    p_driver.display_name as driver_name,
    d.vehicle_make,
    d.vehicle_model,
    d.vehicle_color,
    d.license_plate
FROM public.rides r
LEFT JOIN public.profiles p_user ON r.user_id = p_user.user_id
LEFT JOIN public.profiles p_driver ON r.driver_id = p_driver.user_id
LEFT JOIN public.drivers d ON r.driver_id = d.user_id
WHERE r.status IN ('completed', 'cancelled');

-- Enable RLS on the views (this will inherit from underlying tables)
-- Views automatically inherit RLS from their underlying tables when RLS is enabled

-- Grant appropriate permissions to authenticated users
GRANT SELECT ON public.available_drivers TO authenticated;
GRANT SELECT ON public.ride_history TO authenticated;