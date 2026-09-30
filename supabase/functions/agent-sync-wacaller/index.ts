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

    // Get the business_id from wacaller_customization.users
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

    const businessId = userData.business_id;
    const supabaseInfra = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'whatsapp_infra' } });

    if (req.method === "GET") {
      const { data, error } = await supabaseInfra
        .from('agent_configs')
        .select('*')
        .eq('business_id', businessId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is no rows found
        console.error("Supabase select error:", error);
        throw new Error(error.message);
      }
      
      return new Response(JSON.stringify({ success: true, data: data || {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // It's a POST request
    const { business_prompt, greeting_message, fallback_message, voice_model } = await req.json();

    const { data, error } = await supabaseInfra
      .from('agent_configs')
      .upsert(
        { 
          business_id: businessId, 
          business_prompt: business_prompt || "", 
          greeting_message: greeting_message || "",
          fallback_message: fallback_message || "",
          voice_model: voice_model || "models/gemini-3.1-flash-live-preview",
          updated_at: new Date().toISOString()
        },
        { onConflict: 'business_id' }
      )
      .select();

    if (error) {
      console.error("Supabase upsert error:", error);
      throw new Error(error.message);
    }

    return new Response(JSON.stringify({ success: true, data: data[0] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in agent-sync-wacaller:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
