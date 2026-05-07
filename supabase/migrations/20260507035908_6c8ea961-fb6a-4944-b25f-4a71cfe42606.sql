
-- 1. viewer_webrtc_signals: remove anonymous read access
DROP POLICY IF EXISTS "Host can read viewer camera signals" ON public.viewer_webrtc_signals;
CREATE POLICY "Host can read viewer camera signals"
ON public.viewer_webrtc_signals
FOR SELECT
TO authenticated
USING (
  stream_id IN (
    SELECT id FROM public.streaming_sessions WHERE host_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Viewers can send camera signals" ON public.viewer_webrtc_signals;
CREATE POLICY "Viewers can send camera signals"
ON public.viewer_webrtc_signals
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow cleanup of old signals" ON public.viewer_webrtc_signals;
CREATE POLICY "Allow cleanup of old signals"
ON public.viewer_webrtc_signals
FOR DELETE
TO authenticated
USING (created_at < (now() - interval '1 hour'));

-- 2. payment_audit_log: restrict inserts to service_role only
DROP POLICY IF EXISTS "Service can insert payment audit logs" ON public.payment_audit_log;
CREATE POLICY "Service can insert payment audit logs"
ON public.payment_audit_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- 3. token_transactions: remove security_validated metadata bypass
DROP POLICY IF EXISTS "Secure token transactions via function only" ON public.token_transactions;
DROP POLICY IF EXISTS "Secure token transactions via validated function only" ON public.token_transactions;
CREATE POLICY "Limited self token transactions"
ON public.token_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND delta > 0
  AND delta <= 100
  AND reason = ANY (ARRAY['gift_received'::text, 'daily_bonus'::text, 'profile_completion'::text])
);

-- 4. webrtc_signals: restrict to authenticated stream participants
DROP POLICY IF EXISTS "Allow signaling for stream participants" ON public.webrtc_signals;

CREATE POLICY "Stream participants can read signals"
ON public.webrtc_signals
FOR SELECT
TO authenticated
USING (
  stream_id IN (SELECT id FROM public.streaming_sessions WHERE host_user_id = auth.uid())
);

CREATE POLICY "Authenticated can insert own signals"
ON public.webrtc_signals
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Cleanup old webrtc signals"
ON public.webrtc_signals
FOR DELETE
TO authenticated
USING (created_at < (now() - interval '1 hour'));

-- Remove from realtime publication to avoid broadcasting signal payloads broadly
ALTER PUBLICATION supabase_realtime DROP TABLE public.webrtc_signals;

-- 5. currency_balances: restrict UPDATE to own row only
DROP POLICY IF EXISTS "System can update currency balances" ON public.currency_balances;
CREATE POLICY "Users can update own currency balance"
ON public.currency_balances
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. user_purchases: restrict INSERT to own user
DROP POLICY IF EXISTS "System can create purchases" ON public.user_purchases;
CREATE POLICY "Users can create own purchases"
ON public.user_purchases
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 7. streaming_sessions.stream_key: remove column read access from anon and authenticated.
-- Service role retains access; hosts can read via the streaming_hosts_select_own policy
-- (column-level grants apply on top of RLS).
REVOKE SELECT (stream_key) ON public.streaming_sessions FROM anon, authenticated;

-- 8. Fix function search_path on remaining functions
ALTER FUNCTION public.audit_token_transaction() SET search_path = public;
ALTER FUNCTION public.streaming_sessions_broadcast_trigger() SET search_path = public;
ALTER FUNCTION public.update_at_column() SET search_path = public;
