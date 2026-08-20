import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const FOUNDING_CLAIM_TOKEN_KEY = "oloo.foundingClaimToken";

export type ClaimResult = {
  ok: boolean;
  awarded: number;
  balance: number;
  already: boolean;
  code: string;
  message: string;
};

export const CLAIM_ERROR_COPY: Record<string, string> = {
  invalid_token: "This claim link is not valid.",
  claim_not_found_or_used: "We could not find a pending founding-credit claim for your email.",
  claim_token_expired: "This claim link has expired. Please request a new one from join.oloo.media.",
  claim_not_pending: "These founding credits have already been claimed.",
  email_mismatch:
    "Your Òloo account email does not match the email on your waitlist signup. Sign in with the same email to claim.",
  email_not_verified: "Please verify your Òloo account email before claiming.",
  account_already_claimed: "This Òloo account has already received founding credits.",
  authentication_required: "Please sign in to claim your founding credits.",
  award_failed: "We could not credit your account. Please try again.",
  internal_error: "Something went wrong on our side. Please try again.",
};

/** Reads the real error body from a failed edge-function invocation. */
async function readErrorBody(error: unknown): Promise<Record<string, unknown> | null> {
  const ctx = (error as { context?: Response })?.context;
  if (!ctx || typeof ctx.json !== "function") return null;
  try {
    return (await ctx.clone().json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Redeems the founding-credit claim for the currently authenticated user.
 * The token is optional — the edge function falls back to the verified,
 * normalized email, which is what makes the new-user (post-Google-signup)
 * path work after the claim URL has been left behind.
 */
export async function redeemFoundingClaim(token?: string | null): Promise<ClaimResult> {
  const { data, error } = await supabase.functions.invoke("claim-founding-credits", {
    body: { token: token ?? null },
  });

  let result = (data ?? null) as Record<string, unknown> | null;
  if (!result && error) result = await readErrorBody(error);

  if (!result) {
    console.error("[FoundingClaim] invoke failed with no response body", error);
    return { ok: false, code: "internal_error", message: CLAIM_ERROR_COPY.internal_error };
  }

  if (result.success) {
    return {
      ok: true,
      awarded: Number(result.credits_awarded ?? 0),
      balance: Number(result.balance ?? 0),
      already: result.status === "already_claimed",
    };
  }

  const code = String(result.error ?? "unknown");
  console.error("[FoundingClaim] redemption failed", result);
  return {
    ok: false,
    code,
    message: CLAIM_ERROR_COPY[code] ?? `We could not complete your claim (${code}).`,
  };
}

/**
 * Background redeemer used once the Main Òloo user exists (inside /app).
 * Runs only when a pending claim token was stored before authentication.
 * Idempotent: the edge function + RPC guarantee a single +500 transaction.
 */
export const useFoundingClaimRedeemer = () => {
  return useCallback(async () => {
    const token = localStorage.getItem(FOUNDING_CLAIM_TOKEN_KEY);
    if (!token) return null;
    const result = await redeemFoundingClaim(token);
    // Clear on success and on terminal failures; keep it for transient errors
    // so a later refresh can retry.
    const terminal = ["claim_not_pending", "email_mismatch", "account_already_claimed", "invalid_token", "claim_token_expired", "claim_not_found_or_used"];
    if (result.ok === true || terminal.includes((result as { code: string }).code)) {
      localStorage.removeItem(FOUNDING_CLAIM_TOKEN_KEY);
    }
    return result;
  }, []);
};
