import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const tail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[check-subscription] ${step}${tail}`);
};

// Map of price IDs to tier names
const PRICE_TO_TIER: Record<string, string> = {
  price_1TSX1aDk99oHHjutcIGGgNil: "premium",
  price_1TTkDqDk99oHHjutBNMU9hwM: "silver",
  price_1TTkDrDk99oHHjutS0gKwVkN: "gold",
  price_1TTkDsDk99oHHjutdoJtGYl0: "platinum",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) throw new Error(`Auth error: ${userErr.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    log("user", { id: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      log("no customer");
      return new Response(
        JSON.stringify({ subscribed: false, isPremium: false, tier: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const customerId = customers.data[0].id;
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 5,
    });

    let isPremium = false;
    let tier: string | null = null;
    let subscriptionEnd: string | null = null;
    let priceId: string | null = null;

    for (const sub of subs.data) {
      for (const item of sub.items.data) {
        const pid = item.price.id;
        const t = PRICE_TO_TIER[pid];
        if (t) {
          isPremium = true;
          tier = t;
          priceId = pid;
          // Stripe API 2025-08-27 moved current_period_end onto the item.
          // Fall back to subscription-level field for older shapes, then guard.
          const periodEnd =
            (item as any).current_period_end ??
            (sub as any).current_period_end ??
            null;
          if (typeof periodEnd === "number" && Number.isFinite(periodEnd)) {
            try {
              subscriptionEnd = new Date(periodEnd * 1000).toISOString();
            } catch {
              subscriptionEnd = null;
            }
          }
          break;
        }
      }
      if (isPremium) break;
    }

    // Sync to memberships table (best-effort)
    if (isPremium && tier) {
      try {
        await supabase.from("memberships").upsert({
          user_id: user.id,
          tier,
          status: "active",
          stripe_customer_id: customerId,
          expires_at: subscriptionEnd,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      } catch (e) {
        log("membership sync skipped", { e: String(e) });
      }
    }

    log("result", { isPremium, tier, priceId, subscriptionEnd });

    return new Response(
      JSON.stringify({
        subscribed: isPremium,
        isPremium,
        tier,
        price_id: priceId,
        subscription_end: subscriptionEnd,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg, isPremium: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
