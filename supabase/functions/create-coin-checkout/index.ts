import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Coin package mapping: package_id -> { price_id, coins, bonus }
const COIN_PACKAGES: Record<number, { price_id: string; coins: number; bonus: number }> = {
  1: { price_id: "price_1StiYMDk99oHHjutPTfH6HTO", coins: 100, bonus: 0 },
  2: { price_id: "price_1Stia3Dk99oHHjutXd1trDfi", coins: 500, bonus: 50 },
  3: { price_id: "price_1StiaBDk99oHHjutXGmvSk0y", coins: 1000, bonus: 200 },
  4: { price_id: "price_1StiaCDk99oHHjutmBDOIgs8", coins: 2000, bonus: 500 },
  5: { price_id: "price_1StiaDDk99oHHjut0T1KvPHm", coins: 5000, bonus: 2000 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }

    const { package_id } = await req.json();
    const coinPackage = COIN_PACKAGES[package_id];
    
    if (!coinPackage) {
      throw new Error("Invalid package selected");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if Stripe customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create checkout session with metadata for webhook processing
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: coinPackage.price_id,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/profile?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/profile?payment=canceled`,
      metadata: {
        user_id: user.id,
        package_id: package_id.toString(),
        coins: coinPackage.coins.toString(),
        bonus: coinPackage.bonus.toString(),
        total_coins: (coinPackage.coins + coinPackage.bonus).toString(),
      },
    });

    console.log("Checkout session created:", session.id, "for user:", user.id);

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
