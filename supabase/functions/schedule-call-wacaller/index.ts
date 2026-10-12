import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseWacaller = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'wacaller_customization' } });
    
    // Check if the user is a staff member
    const { data: staffData } = await supabaseWacaller
      .from('staff_accounts')
      .select('owner_id')
      .eq('staff_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    const businessId = staffData?.owner_id || user.id;
    const supabaseInfra = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'whatsapp_infra' } });

    // Handle GET: retrieve scheduled calls queue for this business
    if (req.method === "GET") {
      const { data: calls, error: callsError } = await supabaseInfra
        .from('scheduled_calls')
        .select('*')
        .eq('business_id', businessId)
        .order('scheduled_time', { ascending: false })
        .limit(50);

      if (callsError) {
        throw new Error(callsError.message);
      }

      return new Response(JSON.stringify({ success: true, calls }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { numbers, gapMinutes } = await req.json();

    if (!Array.isArray(numbers) || numbers.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid numbers array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gap = typeof gapMinutes === 'number' ? gapMinutes : 1; // default 1 min

    // Create the schedule payloads
    const now = new Date();
    const scheduledCalls = numbers
      .map((p: any) => typeof p === 'string' ? p.replace(/[\s\-\(\)\+]/g, '').trim() : '')
      .filter((p: string) => p.length >= 7)
      .map((phone: string, index: number) => {
        const scheduledTime = new Date(now.getTime() + index * gap * 60000);
        return {
          business_id: businessId,
          phone_number: phone,
          scheduled_time: scheduledTime.toISOString(),
          status: 'pending'
        };
      });

    if (scheduledCalls.length === 0) {
      return new Response(JSON.stringify({ error: "No valid phone numbers found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabaseInfra
      .from('scheduled_calls')
      .insert(scheduledCalls)
      .select();

    if (error) {
      throw new Error(error.message);
    }

    return new Response(JSON.stringify({ success: true, count: data.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in schedule-call-wacaller:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
