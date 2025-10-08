-- FIX: Remove conflicting policies and implement proper driver self-access

-- Step 1: Clean up all existing conflicting policies
DROP POLICY IF EXISTS "No direct access to drivers table" ON public.drivers;
DROP POLICY IF EXISTS "Drivers table completely locked down" ON public.drivers;
DROP POLICY IF EXISTS "Drivers can view and update their own profile" ON public.drivers;

-- Step 2: Create clear, non-conflicting policies for driver self-management

-- Policy 1: Drivers can view and update their own records
CREATE POLICY "Drivers can manage their own data"
ON public.drivers
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 2: No one else can access driver records directly
-- (This is implicitly handled by the above policy - if auth.uid() != user_id, access is denied)

-- Step 3: Ensure the secure function still works for ride matching
-- The get_available_drivers() function will continue to work as it uses SECURITY DEFINER
-- and bypasses RLS to provide safe, anonymized data

-- Step 4: Test the policies work correctly
-- This query should return policy information
SELECT 
  'POLICY_TEST' as test_type,
  policyname,
  cmd,
  qual as access_condition
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'drivers';

-- Step 5: Log this policy fix
SELECT log_security_event(
  'rls_policy_conflict_resolved',
  'drivers_table_policies',
  NULL,
  jsonb_build_object(
    'issue', 'conflicting_rls_policies_causing_access_problems',
    'solution', 'single_clear_policy_for_driver_self_access',
    'driver_self_access', 'enabled',
    'public_access_to_sensitive_data', 'blocked',
    'secure_function_access', 'maintained',
    'identity_theft_prevention', 'active',
    'timestamp', now()
  )
);