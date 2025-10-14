-- Fix SUPA_security_definer_view warning
-- Drop the unused live_streams view that bypasses RLS
-- The application should use the streaming_sessions table directly with proper RLS policies

DROP VIEW IF EXISTS public.live_streams;

-- Add comment to explain why we removed the view
COMMENT ON TABLE public.streaming_sessions IS 
  'Streaming sessions table with proper RLS policies. Use this table directly instead of views to ensure RLS policies are properly enforced. Previous live_streams view was removed to fix security definer view warning.';