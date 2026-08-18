REVOKE ALL ON public.founding_credit_claims FROM anon, authenticated;
REVOKE ALL ON public.integration_nonces FROM anon, authenticated;
GRANT ALL ON public.founding_credit_claims TO service_role;
GRANT ALL ON public.integration_nonces TO service_role;