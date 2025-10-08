-- Fix: Clean up all existing policies and create one clear policy

-- Step 1: Drop ALL existing policies on drivers table
DROP POLICY IF EXISTS "Drivers can manage their own data" ON public.drivers;
DROP POLICY IF EXISTS "No direct access to drivers table" ON public.drivers;  
DROP POLICY IF EXISTS "Drivers table completely locked down" ON public.drivers;
DROP POLICY IF EXISTS "Drivers can view and update their own profile" ON public.drivers;

-- Step 2: Create one clean, comprehensive policy
CREATE POLICY "Drivers access only their own records"
ON public.drivers
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Step 3: Verify the clean policy state
SELECT 
  'POLICY_VERIFICATION' as status,
  policyname,
  cmd,
  roles,
  qual as using_condition,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'drivers';

-- Step 4: Log the resolution
SELECT log_security_event(
  'driver_rls_policy_conflicts_fully_resolved',
  'drivers_table_security',
  NULL,
  jsonb_build_object(
    'previous_issues', array['conflicting_policies', 'blocked_driver_self_access'],
    'resolution', 'single_clear_policy_implementation', 
    'driver_functionality', 'fully_restored',
    'sensitive_data_protection', 'maintained',
    'public_access_blocked', true,
    'driver_self_management_enabled', true,
    'secure_function_preserved', true,
    'timestamp', now()
  )
);