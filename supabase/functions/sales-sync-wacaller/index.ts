import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("Received webhook payload:", JSON.stringify(payload));

    const record = payload.record;
    
    // We expect record to be from whatsapp_infra.call_logs
    if (!record || !record.caller_number) {
      return new Response(JSON.stringify({ error: "Invalid payload or missing caller_number" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const duration = record.duration || 0;
    const status = record.status;
    const phone = record.caller_number;

    // Double check the conditions to be robust
    if (status !== "ended" || duration <= 30) {
      console.log(`Skipping. Status: ${status}, Duration: ${duration}`);
      return new Response(JSON.stringify({ skipped: true, reason: "Condition not met" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const apiKey = Deno.env.get("CALLER_API_KEY");
    if (!apiKey) {
      throw new Error("Missing CALLER_API_KEY environment variable");
    }

    const apiUrl = "https://sales.buildstart.io/api/public/caller/call-complete";
    
    const requestBody = {
      phone: phone,
      call_status: "answered",
      call_duration_seconds: Math.floor(duration),
      send_whatsapp: true
    };

    console.log("Sending to seller dashboard:", JSON.stringify(requestBody));

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const responseData = await response.text();
    console.log(`Seller dashboard response [${response.status}]:`, responseData);

    if (!response.ok) {
      throw new Error(`Seller dashboard returned ${response.status}: ${responseData}`);
    }

    return new Response(JSON.stringify({ success: true, seller_dashboard_response: responseData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in sales-sync-wacaller:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
