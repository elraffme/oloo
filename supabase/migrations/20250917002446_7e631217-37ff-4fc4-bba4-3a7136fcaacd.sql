-- Fix Security Definer View Issue - Critical Security Error
-- Remove the potentially unsafe view and replace with secure function approach

-- Drop the security definer view that was flagged as unsafe
DROP VIEW IF EXISTS public.ride_summaries;

-- Create a secure function to get ride summaries instead of a view
-- This avoids the security definer view issue while maintaining functionality
CREATE OR REPLACE FUNCTION public.get_ride_summaries()
RETURNS TABLE(
  id uuid,
  ride_type text,
  status text,
  created_at timestamp with time zone,
  price_tier text,
  duration_tier text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate access and log the request
  IF auth.uid() IS NULL THEN
    PERFORM log_security_event('unauthorized_ride_summary_access', 'rides', NULL, 
      jsonb_build_object('error', 'no_auth', 'method', 'function_call'));
    RETURN;
  END IF;

  -- Log the summary access for security audit
  PERFORM log_security_event('ride_summaries_accessed', 'rides', NULL, 
    jsonb_build_object(
      'user_id', auth.uid(),
      'access_method', 'secure_function',
      'data_classification', 'anonymized_summary'
    ));

  -- Return anonymized ride summaries for the authenticated user
  RETURN QUERY
  SELECT 
    r.id,
    r.ride_type,
    r.status,
    r.created_at,
    CASE 
      WHEN r.estimated_price < 10 THEN 'budget'
      WHEN r.estimated_price < 25 THEN 'standard'
      ELSE 'premium'
    END as price_tier,
    CASE 
      WHEN r.estimated_duration_minutes < 15 THEN 'short'
      WHEN r.estimated_duration_minutes < 45 THEN 'medium'
      ELSE 'long'
    END as duration_tier
  FROM public.rides r
  WHERE (auth.uid() = r.user_id OR auth.uid() = r.driver_id)
    AND auth.uid() IS NOT NULL;
END;
$$;

-- Fix the search path issue for existing functions that were flagged
-- These functions need proper search_path set to avoid security warnings

-- Fix validate_ride_access function search path (already has it, but making sure)
CREATE OR REPLACE FUNCTION public.validate_ride_access(ride_id uuid, access_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ride_record RECORD;
  access_count INTEGER;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Strict authentication check
  IF current_user_id IS NULL THEN
    PERFORM log_security_event('unauthorized_ride_access_attempt', 'rides', ride_id, 
      jsonb_build_object('access_type', access_type, 'error', 'no_auth'));
    RETURN FALSE;
  END IF;
  
  -- Get ride details
  SELECT * INTO ride_record FROM public.rides WHERE id = ride_id;
  
  IF NOT FOUND THEN
    PERFORM log_security_event('ride_access_denied', 'rides', ride_id, 
      jsonb_build_object('access_type', access_type, 'error', 'not_found'));
    RETURN FALSE;
  END IF;
  
  -- Check if user is authorized (either the rider or assigned driver)
  IF current_user_id != ride_record.user_id AND current_user_id != ride_record.driver_id THEN
    PERFORM log_security_event('unauthorized_ride_access_attempt', 'rides', ride_id, 
      jsonb_build_object(
        'access_type', access_type, 
        'requested_by', current_user_id,
        'ride_user_id', ride_record.user_id,
        'ride_driver_id', ride_record.driver_id,
        'classification', 'security_violation'
      ));
    RETURN FALSE;
  END IF;
  
  -- Rate limiting: Check for suspicious bulk access patterns
  SELECT COUNT(*) INTO access_count
  FROM public.security_audit_log
  WHERE user_id = current_user_id 
    AND action LIKE '%ride%'
    AND created_at >= (now() - interval '1 hour');
    
  IF access_count > 50 THEN
    PERFORM log_security_event('ride_access_rate_limit_exceeded', 'rides', ride_id, 
      jsonb_build_object(
        'access_type', access_type,
        'hourly_access_count', access_count,
        'security_level', 'high'
      ));
    RETURN FALSE;
  END IF;
  
  -- Log legitimate access
  PERFORM log_security_event('ride_data_accessed', 'rides', ride_id, 
    jsonb_build_object(
      'access_type', access_type,
      'ride_status', ride_record.status,
      'access_pattern', 'authorized',
      'data_sensitivity', 'financial_location'
    ));
  
  RETURN TRUE;
END;
$$;

-- Fix other functions to ensure they have proper search paths
-- This should resolve the remaining "Function Search Path Mutable" warnings

CREATE OR REPLACE FUNCTION public.get_anonymized_ride_data(ride_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  ride_record RECORD;
BEGIN
  -- Validate access first
  IF NOT validate_ride_access(ride_id, 'anonymized_view') THEN
    RETURN '{}'::jsonb;
  END IF;
  
  SELECT * INTO ride_record FROM public.rides WHERE id = ride_id;
  
  -- Return anonymized data (no precise locations or full financial details)
  SELECT jsonb_build_object(
    'id', id,
    'ride_type', ride_type,
    'status', status,
    'created_at', created_at,
    -- Anonymized location data
    'pickup_area', 
      CASE 
        WHEN pickup_location IS NOT NULL THEN 
          split_part(pickup_location, ',', 1) || ' area'
        ELSE 'Unknown area'
      END,
    'destination_area', 
      CASE 
        WHEN destination IS NOT NULL THEN 
          split_part(destination, ',', 1) || ' area'
        ELSE 'Unknown area'
      END,
    -- Anonymized pricing (ranges instead of exact amounts)
    'price_range',
      CASE 
        WHEN estimated_price < 10 THEN 'Under $10'
        WHEN estimated_price < 25 THEN '$10-25'
        WHEN estimated_price < 50 THEN '$25-50'
        ELSE 'Over $50'
      END,
    'duration_range',
      CASE 
        WHEN estimated_duration_minutes < 15 THEN 'Under 15 min'
        WHEN estimated_duration_minutes < 30 THEN '15-30 min'
        WHEN estimated_duration_minutes < 60 THEN '30-60 min'
        ELSE 'Over 1 hour'
      END,
    'security_enhanced', true
  ) INTO result
  FROM public.rides
  WHERE id = ride_id;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_secure_ride_details(ride_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  current_user_id uuid;
  ride_record RECORD;
BEGIN
  current_user_id := auth.uid();
  
  -- Enhanced validation
  IF NOT validate_ride_access(ride_id, 'full_details') THEN
    RETURN '{}'::jsonb;
  END IF;
  
  SELECT * INTO ride_record FROM public.rides WHERE id = ride_id;
  
  -- Time-based restriction: Only allow access to rides within last 90 days for security
  IF ride_record.created_at < (now() - interval '90 days') THEN
    PERFORM log_security_event('historical_ride_access_denied', 'rides', ride_id, 
      jsonb_build_object(
        'ride_age_days', EXTRACT(days FROM (now() - ride_record.created_at)),
        'security_reason', 'data_retention_policy'
      ));
    RETURN jsonb_build_object('error', 'Historical data access restricted for security');
  END IF;
  
  -- Return appropriate data based on user role
  IF current_user_id = ride_record.user_id THEN
    -- User gets their ride details (masked driver sensitive info)
    SELECT jsonb_build_object(
      'id', id,
      'pickup_location', pickup_location,
      'destination', destination,
      'ride_type', ride_type,
      'status', status,
      'estimated_price', estimated_price,
      'actual_price', actual_price,
      'estimated_duration_minutes', estimated_duration_minutes,
      'actual_duration_minutes', actual_duration_minutes,
      'user_rating', user_rating,
      'driver_rating', driver_rating,
      'created_at', created_at,
      'accepted_at', accepted_at,
      'started_at', started_at,
      'completed_at', completed_at,
      'driver_notes', driver_notes,
      'user_role', 'passenger',
      'security_enhanced', true
    ) INTO result
    FROM public.rides WHERE id = ride_id;
    
  ELSIF current_user_id = ride_record.driver_id THEN
    -- Driver gets ride details (needed for navigation and service)
    SELECT jsonb_build_object(
      'id', id,
      'pickup_location', pickup_location,
      'destination', destination,
      'pickup_coordinates', pickup_coordinates,
      'destination_coordinates', destination_coordinates,
      'ride_type', ride_type,
      'status', status,
      'estimated_price', estimated_price,
      'actual_price', actual_price,
      'estimated_duration_minutes', estimated_duration_minutes,
      'actual_duration_minutes', actual_duration_minutes,
      'driver_rating', driver_rating,
      'created_at', created_at,
      'accepted_at', accepted_at,
      'started_at', started_at,
      'completed_at', completed_at,
      'driver_notes', driver_notes,
      'user_role', 'driver',
      'security_enhanced', true
    ) INTO result
    FROM public.rides WHERE id = ride_id;
  ELSE
    RETURN '{}'::jsonb;
  END IF;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_ride_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_security_event('ride_inserted', 'rides', NEW.id, 
      jsonb_build_object(
        'ride_type', NEW.ride_type,
        'estimated_price', NEW.estimated_price,
        'pickup_location', LEFT(NEW.pickup_location, 50),
        'operation', 'INSERT'
      ));
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    PERFORM log_security_event('ride_updated', 'rides', NEW.id, 
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'updated_by', auth.uid(),
        'operation', 'UPDATE'
      ));
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    PERFORM log_security_event('ride_deletion_attempt', 'rides', OLD.id, 
      jsonb_build_object(
        'ride_status', OLD.status,
        'operation', 'DELETE_BLOCKED'
      ));
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;