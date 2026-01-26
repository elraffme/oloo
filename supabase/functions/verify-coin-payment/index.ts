import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Use service role key to update balances
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData.user;
    if (!user) {
      throw new Error("User not authenticated");
    }

    const { session_id } = await req.json();
    if (!session_id) {
      throw new Error("Session ID is required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    console.log("Verifying session:", session_id, "status:", session.payment_status);

    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Payment not completed",
        status: session.payment_status 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Verify the user_id matches
    const sessionUserId = session.metadata?.user_id;
    if (sessionUserId !== user.id) {
      throw new Error("Session does not belong to this user");
    }

    // Check if this payment has already been processed
    const { data: existingTransaction } = await supabase
      .from('currency_transactions')
      .select('id')
      .eq('reference_id', session.payment_intent as string)
      .single();

    if (existingTransaction) {
      console.log("Payment already processed:", session.payment_intent);
      return new Response(JSON.stringify({ 
        success: true, 
        already_processed: true,
        message: "Payment was already processed"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get coin amounts from metadata
    const totalCoins = parseInt(session.metadata?.total_coins || "0");
    const packageId = parseInt(session.metadata?.package_id || "0");

    if (totalCoins <= 0) {
      throw new Error("Invalid coin amount in session");
    }

    // Get or create currency balance
    let { data: balance } = await supabase
      .from('currency_balances')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!balance) {
      // Create initial balance
      const { data: newBalance, error: createError } = await supabase
        .from('currency_balances')
        .insert({ user_id: user.id, coin_balance: 0 })
        .select()
        .single();
      
      if (createError) throw createError;
      balance = newBalance;
    }

    const newBalance = (balance.coin_balance || 0) + totalCoins;
    const newLifetimePurchased = (balance.lifetime_coins_purchased || 0) + totalCoins;

    // Update balance
    const { error: updateError } = await supabase
      .from('currency_balances')
      .update({ 
        coin_balance: newBalance,
        lifetime_coins_purchased: newLifetimePurchased,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    // Record the transaction
    const { error: txError } = await supabase
      .from('currency_transactions')
      .insert({
        user_id: user.id,
        currency_type: 'coins',
        transaction_type: 'purchase',
        amount: totalCoins,
        balance_after: newBalance,
        reason: `Purchased ${totalCoins} coins via Stripe`,
        reference_id: session.payment_intent as string,
        metadata: {
          stripe_session_id: session_id,
          stripe_payment_intent: session.payment_intent,
          package_id: packageId,
          amount_paid_cents: session.amount_total
        }
      });

    if (txError) {
      console.error("Error recording transaction:", txError);
      // Don't throw - the coins are already added
    }

    console.log("Payment verified and coins added:", totalCoins, "to user:", user.id);

    return new Response(JSON.stringify({ 
      success: true, 
      coins_added: totalCoins,
      new_balance: newBalance
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
