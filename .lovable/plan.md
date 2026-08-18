# Founding-Credit Bridge — Main Oloo receiving side

## What the inspection found (Main Oloo, project kdvnxzniqyomdeicmycs)

- `award_coins()` is broken: it writes `currency_type = 'coin'` and `transaction_type = 'earn'`, but the table constraints only allow `coins|gold` and `purchase|gift_sent|gift_received|conversion|reward|refund|withdrawal`. Every call fails.
- `award_coins()` is executable by `anon` and `authenticated` and takes an arbitrary user id and amount — anyone with the publishable key can mint coins once the value bug is fixed.
- `currency_balances` has an UPDATE policy for `authenticated` with `auth.uid() = user_id`, so a user can set their own `coin_balance` to any value. No app code performs that update (all writes go through service-role edge functions / RPCs), so removing it breaks nothing.
- No idempotency anywhere: no claim table, no unique reference id on `currency_transactions`.
- No HTTP endpoint awards credits or returns a balance.
- The two projects have separate Auth; the Join `auth.users.id` has no meaning here.

## Identity linking — chosen design

Neither pure Option A nor pure Option B is sufficient on its own: a server-to-server email match (Option B) silently grants credits to whoever controls an email in Main Oloo's DB, and many waitlist users have no Main Oloo account yet. Option A alone can't prove the user is the eligible Join user.

Chosen: **B for eligibility assertion + A for identity proof** — a two-step pending-claim flow.

1. Join's backend (never the browser) calls the HMAC-signed award endpoint with the Join user's id and the Google-verified email it holds server-side. Main Oloo verifies the HMAC, so the email is an assertion from a trusted server, not from a client.
2. Main Oloo does **not** award yet. It creates/returns a `pending` claim row with a single-use, hashed, short-lived claim token, plus a `claim_url` on oloo.media.
3. The user opens the claim URL and authenticates on Main Oloo (Google or email). A second edge function, called with the user's Main Oloo JWT, redeems the token: it requires `auth.jwt().email_verified` and that the Main Oloo verified email equals the Join-asserted email. Only then is `main_user_id` written and 500 coins awarded.

This makes the link provable on both sides: Join proves the Join identity via HMAC, Main Oloo proves the Main identity via its own session. No client-supplied `main_user_id`, no browser-supplied email, no award without a real Main Oloo login.

## Database changes

New table `public.founding_credit_claims`:

- `id`, `join_user_id uuid NOT NULL`, `join_email_normalized text NOT NULL`, `main_user_id uuid NULL REFERENCES auth.users`, `idempotency_key text NOT NULL`, `claim_token_hash text`, `token_expires_at`, `status text` (`pending|claimed|revoked`), `credits_awarded int`, `transaction_id uuid`, `source text`, `created_at`, `claimed_at`.
- `UNIQUE (join_user_id)`, `UNIQUE (idempotency_key)`, partial `UNIQUE (main_user_id) WHERE main_user_id IS NOT NULL`, partial `UNIQUE (join_email_normalized) WHERE status <> 'revoked'`.
- RLS on, no policies for `anon`/`authenticated` (service_role only) — the user sees their claim through the edge function.

New table `public.integration_nonces` (`nonce`, `source`, `created_at`, `UNIQUE(nonce, source)`) for replay protection; nonces older than 10 minutes are pruned on write.

New `public.claim_founding_credits(p_claim_id uuid, p_main_user_id uuid)` SECURITY DEFINER function that, in one statement chain, locks the claim row, refuses if already claimed, upserts the balance `+500`, inserts the ledger row with `currency_type='coins'`, `transaction_type='reward'`, `reference_id = claim.id`, and flips the row to `claimed`. Uniqueness is enforced by the DB constraints, not by SELECT-then-INSERT. Award amount lives in a server-side constant (500), never in the request.

Fixes to existing objects:
- `award_coins()` corrected to `'coins'` / `'reward'`.
- `REVOKE EXECUTE` on `award_coins` from `anon`/`authenticated` (service_role + definer only).
- Drop the self-UPDATE policy on `currency_balances`; keep SELECT and the INSERT-own-row policy used by `useCurrency`.
- Unique index on `currency_transactions (reference_id)` where `reason = 'founding_credit'` as a second line of defence.

## Edge functions (Main Oloo)

`public-credits` — `POST /functions/v1/public-credits/award` and `/balance`, `verify_jwt = false`, HMAC-SHA256 over `timestamp.nonce.body` using `JOIN_OLOO_SHARED_SECRET`, timestamp window ±300s, nonce stored once, `x-source` must be `join-oloo`, `x-idempotency-key` required. Responses: `awarded`, `already_claimed`, `pending_link` (with `claim_url`), `not_linked` for balance.

`claim-founding-credits` — called from a new `/claim-founding` page with the Main Oloo user's JWT; redeems the token and triggers the award.

## Testing

Duplicate claim, concurrent retries, bad signature, expired timestamp, replayed nonce, arbitrary `user_id`/`amount` in the body, direct `award_coins` call with the anon key, and a direct `coin_balance` UPDATE as an authenticated user.

## Manual configuration afterwards

You must add the shared secret `JOIN_OLOO_SHARED_SECRET` in Main Oloo, and later set `MAIN_OLOO_API_URL` / `MAIN_OLOO_SHARED_SECRET` in the Join project (out of scope here). I'll report the full API contract when done.
