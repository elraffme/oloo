import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders, normalizeEmail, sha256Hex } from "../_shared/hmac.ts";

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

type Claim = Record<string, any>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "").trim();
    if (!jwt) return json({ success: false, error: "authentication_required" }, 401);

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    const user = userData?.user;
    if (userError || !user) return json({ success: false, error: "authentication_required" }, 401);

    // Identity proof: the Main Òloo session must own a verified email.
    const emailVerified = Boolean(
      (user as unknown as { email_confirmed_at?: string }).email_confirmed_at ??
        (user.user_metadata as Record<string, unknown> | undefined)?.email_verified,
    );
    if (!user.email || !emailVerified) {
      return json({ success: false, error: "email_not_verified" }, 403);
    }
    const normalized = normalizeEmail(user.email);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const token = typeof body.token === "string" ? body.token : null;

    // 1. Already redeemed by this account? Idempotent success.
    //    A ledger row is the ONLY proof of an award: historic claim rows exist
    //    with status='claimed' but no transaction and no main_user_id.
    const { data: existingTx } = await supabase
      .from("currency_transactions")
      .select("id, amount")
      .eq("user_id", user.id)
      .eq("reason", "founding_credit")
      .limit(1)
      .maybeSingle();

    if (existingTx) {
      const { data: bal } = await supabase
        .from("currency_balances")
        .select("coin_balance")
        .eq("user_id", user.id)
        .maybeSingle();
      return json({
        success: true,
        status: "already_claimed",
        credits_awarded: existingTx.amount,
        balance: bal?.coin_balance ?? 0,
      });
    }

    // 2. Resolve the claim: by token when present, otherwise by the verified
    //    normalized email (Join and Main are separate projects, so the email
    //    is the only trustworthy link). Rows that were wrongly marked
    //    'claimed' without an actual award are still resolvable — the RPC
    //    decides whether credits are owed.
    let claim: Claim | null = null;

    if (token && token.length >= 32) {
      const { data } = await supabase
        .from("founding_credit_claims")
        .select("*")
        .eq("claim_token_hash", await sha256Hex(token))
        .maybeSingle();
      if (data) claim = data;
    }

    if (!claim) {
      const { data } = await supabase
        .from("founding_credit_claims")
        .select("*")
        .eq("join_email_normalized", normalized)
        .neq("status", "revoked")
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) claim = data[0];
    }

    if (!claim) return json({ success: false, error: "claim_not_found_or_used" }, 404);
    if (claim.status === "revoked") {
      return json({ success: false, error: "claim_not_pending", status: claim.status }, 409);
    }
    if (claim.join_email_normalized !== normalized) {
      return json({ success: false, error: "email_mismatch" }, 403);
    }


    const { data, error } = await supabase.rpc("claim_founding_credits", {
      p_claim_id: claim.id,
      p_main_user_id: user.id,
    });
    if (error) {
      console.error("claim_founding_credits failed", error);
      return json({ success: false, error: "award_failed", detail: error.message }, 500);
    }

    const result = (data ?? {}) as Record<string, unknown>;
    if (result.status === "not_found" || result.status === "revoked" || result.status === "invalid_user") {
      return json({ success: false, error: "claim_not_pending", status: result.status }, 409);
    }
    // The claim was already awarded to a different Main Òloo account.
    if (result.status === "already_claimed" && result.main_user_id && result.main_user_id !== user.id) {
      return json({ success: false, error: "claim_not_pending", status: "claimed_by_other" }, 409);
    }

    return json({ success: true, ...result });

  } catch (e) {
    console.error("claim-founding-credits error", e);
    return json({ success: false, error: "internal_error", detail: String(e) }, 500);
  }
});
