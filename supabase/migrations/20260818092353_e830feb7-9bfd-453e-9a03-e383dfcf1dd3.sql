GRANT SELECT, INSERT ON TABLE public.currency_balances TO authenticated;
GRANT ALL ON TABLE public.currency_balances TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'currency_balances'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.currency_balances;
  END IF;
END
$$;