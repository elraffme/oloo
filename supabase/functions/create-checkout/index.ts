import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Server-side plan -> price mapping. Never trust client prices.
const PLAN_PRICES: Record<string, string> = {
  premium: "price_1TSX1aDk99oHHjutcIGGgNil",
  silver: "price_1TTkDqDk99oHHjutBNMU9hwM",
  gold: "price_1TTkDrDk99oHHjutS0gKwVkN",
  platinum: "price_1TTkDsDk99oHHjutdoJtGYl0",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabase.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    let plan = "premium";
    let returnTo: string | null = null;
    try {
      const body = await req.json();
      if (body?.plan && typeof body.plan === "string") {
        plan = body.plan.toLowerCase();
      }
      if (body?.return_to && typeof body.return_to === "string") {
        // only allow same-site relative paths
        if (body.return_to.startsWith("/")) returnTo = body.return_to;
      }
    } catch {
      // no body, default
    }

    const priceId = PLAN_PRICES[plan];
    if (!priceId) throw new Error(`Invalid plan: ${plan}`);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    const origin = req.headers.get("origin") || "https://oloo.media";
    const successPath = returnTo
      ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}subscription=success&plan=${plan}`
      : `/app/premium?subscription=success&plan=${plan}`;
    const cancelPath = returnTo
      ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}subscription=canceled`
      : `/app/premium?subscription=canceled`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}${successPath}`,
      cancel_url: `${origin}${cancelPath}`,
      metadata: { user_id: user.id, plan },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[create-checkout]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
