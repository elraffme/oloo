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

// Map of premium price IDs we recognize
const PREMIUM_PRICE_IDS = new Set<string>([
  "price_1TSX1aDk99oHHjutcIGGgNil", // Òloo Premium Monthly $9.99
]);

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
        JSON.stringify({ subscribed: false, isPremium: false }),
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
    let subscriptionEnd: string | null = null;
    let priceId: string | null = null;

    for (const sub of subs.data) {
      for (const item of sub.items.data) {
        const pid = item.price.id;
        if (PREMIUM_PRICE_IDS.has(pid)) {
          isPremium = true;
          priceId = pid;
          subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
          break;
        }
      }
      if (isPremium) break;
    }

    log("result", { isPremium, priceId, subscriptionEnd });

    return new Response(
      JSON.stringify({
        subscribed: isPremium,
        isPremium,
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
