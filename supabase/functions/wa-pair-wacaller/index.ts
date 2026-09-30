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
    const goServerUrl = Deno.env.get("GO_SERVER_URL") || "https://wacaller.bandara.me";

    const response = await fetch(`${goServerUrl}/api/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ business_id: businessId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Go server error:", errorText);
      throw new Error(`Failed to create session on Go server: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify({ success: true, session_id: data.session_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in wa-pair-wacaller:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
