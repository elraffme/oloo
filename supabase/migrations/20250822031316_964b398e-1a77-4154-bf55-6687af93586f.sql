-- Fix conflicting RLS policies that block all access
-- Remove blanket denial policies that override legitimate access rules

-- Drop the problematic "deny all" policies
DROP POLICY IF EXISTS "Deny unauthorized membership access" ON public.memberships;
DROP POLICY IF EXISTS "Deny unauthorized profile access" ON public.profiles;
DROP POLICY IF EXISTS "Block direct audit log access" ON public.security_audit_log;
DROP POLICY IF EXISTS "Block unauthorized payment intent access" ON public.payment_intents;

-- The existing specific restrictive policies will provide proper access control:
-- - memberships: Users can only view/manage their own data, edge functions have controlled access
-- - profiles: Users can only view/update their own profiles  
-- - security_audit_log: Users can view their own events, admins can view all, controlled insertions
-- - payment_intents: Users can view their own intents, service role has full access