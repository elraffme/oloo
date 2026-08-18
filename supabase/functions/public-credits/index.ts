import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  corsHeaders,
  normalizeEmail,
  sha256Hex,
  verifySignedRequest,
} from "../_shared/hmac.ts";

const FOUNDING_CREDIT_AMOUNT = 500; // server-controlled, never taken from the request
const CLAIM_TOKEN_TTL_HOURS = 72;
const ALLOWED_SOURCES = ["join-oloo"];
const CLAIM_BASE_URL = Deno.env.get("MAIN_OLOO_PUBLIC_URL") ?? "https://oloo.media";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function isEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= 255 && /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(v.trim());
}

async function consumeNonce(source: string, nonce: string): Promise<boolean> {
  const { error } = await supabase.from("integration_nonces").insert({ source, nonce });
  if (error) return false; // unique violation => replay
  // opportunistic pruning
  await supabase
    .from("integration_nonces")
    .delete()
    .lt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
  return true;
}

async function currentBalance(userId: string | null): Promise<number> {
  if (!userId) return 0;
  const { data } = await supabase
    .from("currency_balances")
    .select("coin_balance")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.coin_balance ?? 0;
}

function claimUrl(token: string) {
  return `${CLAIM_BASE_URL.replace(/\/$/, "")}/claim-founding?token=${token}`;
}

async function handleAward(body: Record<string, unknown>, idempotencyKey: string, source: string) {
  const joinUserId = body.join_user_id ?? body.user_id;
  const email = body.email ?? body.user_email;

  if (!isUuid(joinUserId)) return json({ success: false, error: "invalid_join_user_id" }, 400);
  if (!isEmail(email)) return json({ success: false, error: "invalid_email" }, 400);
  const normalized = normalizeEmail(email as string);

  // Any client-supplied amount / main_user_id is deliberately ignored.
  const { data: existing } = await supabase
    .from("founding_credit_claims")
    .select("*")
    .or(
      `idempotency_key.eq.${idempotencyKey},join_user_id.eq.${joinUserId},join_email_normalized.eq.${normalized}`,
    )
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (existing.status === "claimed") {
      return json({
        success: true,
        status: "already_claimed",
        join_user_id: existing.join_user_id,
        credits_awarded: existing.credits_awarded,
        balance: await currentBalance(existing.main_user_id),
        transaction_id: existing.transaction_id,
        currency: "coins",
      });
    }
    if (existing.status === "revoked") {
      return json({ success: false, status: "revoked", error: "claim_revoked" }, 409);
    }
    if (existing.join_user_id !== joinUserId || existing.join_email_normalized !== normalized) {
      return json({ success: false, status: "conflict", error: "claim_belongs_to_another_user" }, 409);
    }

    // Tokens are stored hashed and cannot be re-read, so a retry always gets a
    // freshly rotated single-use token (which invalidates the previous one).
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await supabase
      .from("founding_credit_claims")
      .update({
        claim_token_hash: await sha256Hex(token),
        token_expires_at: new Date(Date.now() + CLAIM_TOKEN_TTL_HOURS * 3600_000).toISOString(),
      })
      .eq("id", existing.id)
      .eq("status", "pending");

    return json({
      success: true,
      status: "pending_link",
      claim_id: existing.id,
      credits_pending: FOUNDING_CREDIT_AMOUNT,
      claim_url: claimUrl(token),
      claim_url_expired: false,
      message:
        "The user must sign in to oloo.media with the same email to receive the founding credits.",
    }, 202);
  }

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const { data: inserted, error } = await supabase
    .from("founding_credit_claims")
    .insert({
      join_user_id: joinUserId,
      join_email_normalized: normalized,
      idempotency_key: idempotencyKey,
      claim_token_hash: await sha256Hex(token),
      token_expires_at: new Date(Date.now() + CLAIM_TOKEN_TTL_HOURS * 3600_000).toISOString(),
      source,
    })
    .select("id")
    .single();

  if (error) {
    // Concurrent insert lost the race against a unique index -> treat as duplicate.
    if (error.code === "23505") {
      return json({ success: true, status: "pending_link", claim_url: null, claim_url_expired: true }, 202);
    }
    console.error("claim insert failed", error);
    return json({ success: false, error: "claim_creation_failed" }, 500);
  }

  return json({
    success: true,
    status: "pending_link",
    claim_id: inserted.id,
    credits_pending: FOUNDING_CREDIT_AMOUNT,
    claim_url: claimUrl(token),
    claim_url_expired: false,
    message: "The user must sign in to oloo.media with the same email to receive the founding credits.",
  }, 202);
}

async function handleBalance(body: Record<string, unknown>) {
  const joinUserId = body.join_user_id ?? body.user_id;
  if (!isUuid(joinUserId)) return json({ success: false, error: "invalid_join_user_id" }, 400);

  const { data: claim } = await supabase
    .from("founding_credit_claims")
    .select("main_user_id, status, credits_awarded")
    .eq("join_user_id", joinUserId)
    .maybeSingle();

  if (!claim || claim.status !== "claimed" || !claim.main_user_id) {
    return json({ success: true, status: "not_linked", balance: null, currency: "coins" });
  }

  return json({
    success: true,
    status: "linked",
    balance: await currentBalance(claim.main_user_id),
    currency: "coins",
    founding_credits_awarded: claim.credits_awarded,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const secret = Deno.env.get("JOIN_OLOO_SHARED_SECRET");
  if (!secret) {
    console.error("JOIN_OLOO_SHARED_SECRET is not configured");
    return json({ success: false, error: "integration_not_configured" }, 503);
  }

  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  const action = path.endsWith("/balance") ? "balance" : path.endsWith("/award") ? "award" : null;
  if (!action) return json({ success: false, error: "unknown_endpoint" }, 404);

  const rawBody = await req.text();

  const verified = await verifySignedRequest(req, rawBody, secret, {
    requireIdempotencyKey: action === "award",
    allowedSources: ALLOWED_SOURCES,
  });
  if (!verified.ok) return json({ success: false, error: verified.error }, verified.status);

  if (!(await consumeNonce(verified.source, verified.nonce))) {
    return json({ success: false, error: "replay_detected" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }

  try {
    return action === "award"
      ? await handleAward(body, verified.idempotencyKey, verified.source)
      : await handleBalance(body);
  } catch (e) {
    console.error("public-credits error", e);
    return json({ success: false, error: "internal_error" }, 500);
  }
});
