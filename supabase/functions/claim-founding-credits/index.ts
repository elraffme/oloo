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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "").trim();
    if (!jwt) return json({ success: false, error: "authentication_required" }, 401);

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    const user = userData?.user;
    if (userError || !user) return json({ success: false, error: "authentication_required" }, 401);

    const { token } = await req.json().catch(() => ({ token: null }));
    if (typeof token !== "string" || token.length < 32) {
      return json({ success: false, error: "invalid_token" }, 400);
    }

    const tokenHash = await sha256Hex(token);
    const { data: claim } = await supabase
      .from("founding_credit_claims")
      .select("*")
      .eq("claim_token_hash", tokenHash)
      .maybeSingle();

    if (!claim) return json({ success: false, error: "claim_not_found_or_used" }, 404);
    if (claim.status !== "pending") {
      return json({ success: false, error: "claim_not_pending", status: claim.status }, 409);
    }
    if (claim.token_expires_at && new Date(claim.token_expires_at).getTime() < Date.now()) {
      return json({ success: false, error: "claim_token_expired" }, 410);
    }

    // Identity proof: the Main Oloo session must own the same verified email
    // that the Join backend asserted over the signed channel.
    const emailVerified = Boolean(
      (user as unknown as { email_confirmed_at?: string }).email_confirmed_at ??
        (user.user_metadata as Record<string, unknown> | undefined)?.email_verified,
    );
    if (!user.email || !emailVerified) {
      return json({ success: false, error: "email_not_verified" }, 403);
    }
    if (normalizeEmail(user.email) !== claim.join_email_normalized) {
      return json({ success: false, error: "email_mismatch" }, 403);
    }

    const { data: existingForUser } = await supabase
      .from("founding_credit_claims")
      .select("id")
      .eq("main_user_id", user.id)
      .maybeSingle();
    if (existingForUser && existingForUser.id !== claim.id) {
      return json({ success: false, error: "account_already_claimed" }, 409);
    }

    const { data, error } = await supabase.rpc("claim_founding_credits", {
      p_claim_id: claim.id,
      p_main_user_id: user.id,
    });
    if (error) {
      console.error("claim_founding_credits failed", error);
      return json({ success: false, error: "award_failed" }, 500);
    }

    return json({ success: true, ...(data as Record<string, unknown>) });
  } catch (e) {
    console.error("claim-founding-credits error", e);
    return json({ success: false, error: "internal_error" }, 500);
  }
});
