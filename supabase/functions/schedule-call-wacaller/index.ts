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
    const { data: userData, error: userError } = await supabaseWacaller
      .from('users')
      .select('business_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !userData.business_id) {
      return new Response(JSON.stringify({ error: "User or business not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only business admins or super admins should be able to schedule
    if (userData.role !== 'admin' && userData.role !== 'super_admin' && userData.role !== 'owner') {
        return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
           status: 403,
           headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    const businessId = userData.business_id;

    // Create the schedule payloads
    const now = new Date();
    const scheduledCalls = numbers.map((phone, index) => {
      const scheduledTime = new Date(now.getTime() + index * gap * 60000);
      return {
        business_id: businessId,
        phone_number: phone,
        scheduled_time: scheduledTime.toISOString(),
        status: 'pending'
      };
    });

    const supabaseInfra = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'whatsapp_infra' } });
    
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
