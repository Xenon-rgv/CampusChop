// Supabase Edge Function: paystack-verify
// Verifies a Paystack payment reference and updates the order status securely

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

    const { reference, order_id } = await req.json();

    if (!reference) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: reference" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify transaction with Paystack API
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
      }
    );

    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data.status !== "success") {
      return new Response(
        JSON.stringify({
          status: false,
          verified: false,
          message: verifyData.data?.gateway_response || "Payment was not successful or was abandoned.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Amount paid in Naira
    const paidNaira = Number(verifyData.data.amount) / 100;
    const targetOrderId = order_id || verifyData.data.metadata?.order_id;

    // Connect to Supabase using Service Role to update protected tables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Supabase service credentials not configured on backend." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate order exists and amount matches
    if (targetOrderId) {
      const { data: order, error: orderErr } = await supabaseAdmin
        .from("orders")
        .select("id, total_amount, payment_status")
        .eq("id", targetOrderId)
        .single();

      if (orderErr || !order) {
        return new Response(
          JSON.stringify({ error: "Associated order not found." }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check for duplicate processing
      if (order.payment_status === "paid") {
        return new Response(
          JSON.stringify({
            status: true,
            verified: true,
            message: "Payment has already been verified and processed.",
            order_id: targetOrderId,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Validate amount (allow minimal tolerance for floating point)
      if (Math.abs(Number(order.total_amount) - paidNaira) > 1.0) {
        return new Response(
          JSON.stringify({
            error: `Payment amount mismatch: Expected ₦${order.total_amount}, received ₦${paidNaira}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Update payment record
      await supabaseAdmin
        .from("payments")
        .update({
          status: "successful",
          verified_at: new Date().toISOString(),
          provider_metadata: verifyData.data,
        })
        .eq("payment_reference", reference);

      // Update order status: payment_status = paid, order_status = confirmed
      await supabaseAdmin
        .from("orders")
        .update({
          payment_status: "paid",
          order_status: "confirmed",
        })
        .eq("id", targetOrderId);
    }

    return new Response(
      JSON.stringify({
        status: true,
        verified: true,
        order_id: targetOrderId,
        amount: paidNaira,
        reference,
        message: "Payment successfully verified and order confirmed.",
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
