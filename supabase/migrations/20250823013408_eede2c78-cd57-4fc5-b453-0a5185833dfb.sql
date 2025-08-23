-- Fix critical security issues - Enable RLS on all tables that need it

-- Enable RLS on existing tables that are missing it
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaming_sessions ENABLE ROW LEVEL SECURITY;

-- Fix search path issues for existing functions (update existing functions with proper search path)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    display_name, 
    age, 
    location, 
    bio, 
    occupation,
    verified
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'New User'),
    COALESCE((NEW.raw_user_meta_data ->> 'age')::integer, 25),
    COALESCE(NEW.raw_user_meta_data ->> 'location', 'Unknown'),
    COALESCE(NEW.raw_user_meta_data ->> 'bio', 'Hello, I''m new here!'),
    NEW.raw_user_meta_data ->> 'occupation',
    false
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
$$;

-- Add missing RLS policies for streaming_sessions (they exist in schema but need proper setup)
DROP POLICY IF EXISTS "Stream hosts can fully manage their streams" ON public.streaming_sessions;
DROP POLICY IF EXISTS "Viewers can see safe public stream data only" ON public.streaming_sessions;

CREATE POLICY "Stream hosts can fully manage their streams" ON public.streaming_sessions
FOR ALL USING (auth.uid() = host_user_id) WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Viewers can see safe public stream data only" ON public.streaming_sessions
FOR SELECT USING (
  NOT is_private AND 
  status = 'live' AND 
  auth.uid() <> host_user_id AND 
  auth.uid() IS NOT NULL
);

-- Add missing RLS policies for user_connections (they exist in schema but need proper setup)  
DROP POLICY IF EXISTS "Users can view their connections" ON public.user_connections;
DROP POLICY IF EXISTS "Users can create connections" ON public.user_connections;
DROP POLICY IF EXISTS "Users can update their connections" ON public.user_connections;

CREATE POLICY "Users can view their connections" ON public.user_connections
FOR SELECT USING (auth.uid() = user_id OR auth.uid() = connected_user_id);

CREATE POLICY "Users can create connections" ON public.user_connections
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their connections" ON public.user_connections
FOR UPDATE USING (auth.uid() = user_id);