// Supabase Edge Function: paystack-initialize
// Initializes an online payment transaction securely with Paystack

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      return new Response(
        JSON.stringify({
          error: "PAYSTACK_SECRET_KEY environment variable is not configured in Supabase Edge Functions.",
          configured: false,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { order_id, email, amount, callback_url } = await req.json();

    if (!order_id || !email || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: order_id, email, amount" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Paystack requires amount in kobo (NGN * 100)
    const amountInKobo = Math.round(Number(amount) * 100);
    const reference = `CC-${order_id.substring(0, 8)}-${Date.now()}`;

    // Call Paystack API
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        reference,
        callback_url: callback_url || undefined,
        currency: "NGN",
        metadata: {
          order_id,
          platform: "CampusChop",
        },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      return new Response(
        JSON.stringify({ error: paystackData.message || "Failed to initialize Paystack transaction" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Store pending payment record using Supabase Service Role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      // Look up customer_id from order
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("customer_id")
        .eq("id", order_id)
        .single();

      if (order) {
        await supabaseAdmin.from("payments").insert({
          order_id,
          customer_id: order.customer_id,
          payment_reference: reference,
          payment_provider: "paystack",
          amount,
          currency: "NGN",
          status: "pending",
          provider_metadata: paystackData.data,
        });

        // Update order status to awaiting_payment
        await supabaseAdmin
          .from("orders")
          .update({
            order_status: "awaiting_payment",
            payment_status: "pending",
          })
          .eq("id", order_id);
      }
    }

    return new Response(
      JSON.stringify({
        status: true,
        reference,
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
