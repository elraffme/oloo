# Premium Membership, Livestream Limits, Replays & Token Store

## 1. Premium status (single source of truth)

Premium = active Stripe subscription. We add a `check-subscription` edge function and a `useSubscription` hook + `SubscriptionContext` so the whole app can read `{ isPremium, tier, subscriptionEnd }`.

- New edge function `check-subscription` queries Stripe by user email, returns `{ subscribed, tier, subscription_end }`.
- New edge function `create-checkout` for upgrade flow (subscription mode).
- New edge function `customer-portal` for managing/cancelling subscription.
- `SubscriptionContext` calls `check-subscription` on login, on mount, and every 60s. Exposes `isPremium`.
- We do NOT change the existing `memberships` table writes; we read live status from Stripe so it can't be spoofed client-side.

Stripe products/prices needed (one-time setup via tool): `Premium Monthly` ($9.99/mo) — used as the single premium tier for now. Higher Stripe tiers (Gold/Platinum) can map to the same `isPremium = true` flag.

## 2. Livestream limits (Free vs Premium)

Centralized in `src/lib/streamLimits.ts`:

```text
Free:    duration 15 min, viewers 10,  quality 480p (640x480 @ 600kbps)
Premium: duration unlimited, viewers 100, quality 1080p (1920x1080 @ 2500kbps)
```

Enforcement:
- **Quality** — `useStream.tsx` reads the limit when calling `getUserMedia` and when setting `maxBitrate` on the producer. Premium gets 1080p constraints + higher bitrate cap; free is forced to 480p + 600kbps regardless of existing scaling.
- **Duration** — `StreamingInterface` starts a timer on go-live for free hosts; at 14 min shows a "Stream ends in 1 minute — upgrade for unlimited" toast with Upgrade CTA, at 15 min auto-ends the stream.
- **Viewer cap** — `StreamViewer`/`TikTokStreamViewer` join flow checks current viewer count against host's tier limit (host tier passed from `streaming_sessions.host_user_id` via a small RPC that returns host's premium status). If full, shows a "Stream is full — host can upgrade for higher capacity" message and blocks join.

To know the host's tier when a viewer joins, add a small public RPC `get_stream_host_premium(stream_id)` that returns boolean (computed from a cached `is_premium` column on `streaming_sessions` set when the host goes live). We add `host_is_premium boolean default false` to `streaming_sessions` and set it from the client when starting a stream (after `check-subscription` resolves).

## 3. Stream replays (premium-only, client-side recording)

- Storage bucket `stream-replays` (private, RLS: host can read own; viewers can read if replay marked `is_public`).
- New table `stream_replays` (host_user_id, stream_id, title, storage_path, duration_sec, size_bytes, is_public, created_at).
- In `useStream.tsx`, when a **premium host** starts streaming, also start a `MediaRecorder` on the local combined stream (video+audio). On end-stream, upload the resulting blob to `stream-replays/{host_id}/{stream_id}.webm`, then insert a `stream_replays` row.
- Free hosts: do NOT record. The replay toggle in the UI is shown but disabled with an Upgrade tooltip.
- New page `src/pages/Replays.tsx` — list current user's replays with a `<video>` player using a signed URL. Linked from profile and streaming page.

## 4. Token store fixes

Audit existing flow (`CoinShop`, `create-coin-checkout`, `verify-coin-payment`, `useCurrency`) and fix any breakage. Confirmed scope:
- Ensure `verify-coin-payment` properly credits `currency_balances.coin_balance` and writes a `currency_transactions` row.
- Ensure `useCurrency` refetches after a successful purchase return (success URL handling).
- Ensure RLS for `currency_balances` allows the user to read their own balance after edge-function update (already there per schema).
- No data model changes; behavior fixes only.

Tokens are already used during livestreams via gifts (`LivestreamGiftSelector` → `gift_transactions`). We confirm this still works for both free and premium users (no gating on spending).

## 5. Premium UI affordances

- **Premium badge** — small crown badge component shown next to display name in `ProfileCard`, `VideoTile` (host overlay), chat usernames, and `StreamViewer` host header. Driven by querying `host_is_premium` in lists and `useSubscription` for self.
- **Higher visibility** — discover/streaming feeds order premium hosts first (`ORDER BY host_is_premium DESC, started_at DESC`).
- **Upgrade prompts** — new `<UpgradePrompt />` component used in: free host hitting duration warning, free host trying to enable replay, viewer trying to join a full free-host stream, locked premium-only UI controls (replay toggle, 1080p quality option). All link to `/premium`.
- `Premium.tsx` page wired to `create-checkout` (currently has placeholder buttons).

## 6. Database changes

Single migration:
- `streaming_sessions`: add `host_is_premium boolean not null default false`.
- New table `stream_replays` with RLS (host owns; public replays viewable by all).
- New storage bucket `stream-replays` (private) + RLS policies.
- New RPC `get_stream_host_premium(stream_id uuid) returns boolean` (security definer).

## 7. Files touched

New:
- `supabase/functions/check-subscription/index.ts`
- `supabase/functions/create-checkout/index.ts`
- `supabase/functions/customer-portal/index.ts`
- `src/contexts/SubscriptionContext.tsx`
- `src/hooks/useSubscription.ts`
- `src/lib/streamLimits.ts`
- `src/components/UpgradePrompt.tsx`
- `src/components/PremiumBadge.tsx`
- `src/pages/Replays.tsx`

Edited:
- `src/App.tsx` (provider + route)
- `src/hooks/useStream.tsx` (quality limits, recording, host_is_premium write)
- `src/components/StreamingInterface.tsx` (duration timer + warnings)
- `src/components/StreamViewer.tsx` / `TikTokStreamViewer.tsx` (viewer cap check)
- `src/pages/Premium.tsx` (wire to checkout + show current plan)
- `src/components/CoinShop.tsx` + `useCurrency.ts` (refresh after purchase)
- `supabase/functions/verify-coin-payment/index.ts` (audit/fix crediting)
- `src/components/VideoTile.tsx`, `src/components/ProfileCard.tsx`, `src/components/LiveStreamChat.tsx` (premium badge)
- `src/pages/Discover.tsx` / streaming list (premium-first ordering)

## 8. What you'll need to do

- Confirm the migration when prompted.
- After the Stripe product is created, the `price_id` will be hardcoded in `Premium.tsx` and `create-checkout`. No action needed from you.
- Stripe must already be enabled on the project (it is — `STRIPE_SECRET_KEY` is set per existing coin functions).

## 9. Out of scope for this round

- Server-side SFU recording (SFU infra change).
- Multiple premium tiers with different limits — single `isPremium` boolean for now; tiered pricing can be layered on later.
- Migrating existing `memberships` table to Stripe-sourced status (left untouched to avoid breaking existing data).
