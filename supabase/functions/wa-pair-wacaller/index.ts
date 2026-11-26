import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function loadGoConfig() {
  let fileSecrets: Record<string, string> = {};
  try {
    const mod = await import("./_secrets.ts");
    fileSecrets = mod.SECRETS || mod.default || {};
  } catch {
    // Optional _secrets.ts fallback to Deno.env
  }
  return {
    goApiKey: Deno.env.get("GO_API_KEY") || fileSecrets.GO_API_KEY || "",
    goServerUrl: (
      Deno.env.get("GO_SERVER_URL") ||
      fileSecrets.GO_SERVER_URL ||
      "https://buildstart-calling-agent.buildstart.io"
    ).replace(/\/+$/, ""),
  };
}

function goHeaders(goApiKey: string, json = false): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (json) h["Content-Type"] = "application/json";
  if (goApiKey) h["X-Api-Key"] = goApiKey;
  return h;
}

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

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseWacaller = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: "wacaller_customization" },
    });

    const { data: staffData } = await supabaseWacaller
      .from("staff_accounts")
      .select("owner_id")
      .eq("staff_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const businessId = staffData?.owner_id || user.id;
    const { goApiKey, goServerUrl } = await loadGoConfig();

    let action = "status";
    try {
      const text = await req.text();
      if (text.trim()) {
        const parsed = JSON.parse(text);
        if (parsed?.action) action = String(parsed.action);
      }
    } catch {
      // Empty or non-JSON body defaults to "status"
    }

    const findExistingSession = async () => {
      const res = await fetch(
        `${goServerUrl}/api/sessions?business_id=${encodeURIComponent(businessId)}`,
        {
          method: "GET",
          headers: goHeaders(goApiKey),
          signal: AbortSignal.timeout(15_000),
        }
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Go server session check failed (${res.status}): ${errText}`);
      }
      const payload = await res.json();
      const list = Array.isArray(payload?.sessions) ? payload.sessions : [];
      return list.find((s: any) => s.business_id === businessId) || null;
    };

    const createSession = async () => {
      const res = await fetch(`${goServerUrl}/api/sessions`, {
        method: "POST",
        headers: goHeaders(goApiKey, true),
        body: JSON.stringify({ business_id: businessId }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to create session on Go server: ${res.status} ${errText}`);
      }
      return await res.json();
    };

    if (action === "delete") {
      const existing = await findExistingSession();
      if (existing?.id) {
        const delRes = await fetch(`${goServerUrl}/api/sessions/${encodeURIComponent(existing.id)}`, {
          method: "DELETE",
          headers: goHeaders(goApiKey),
          signal: AbortSignal.timeout(20_000),
        });
        if (!delRes.ok && delRes.status !== 404) {
          throw new Error(`Failed to delete session (${delRes.status})`);
        }
      }
      return new Response(JSON.stringify({ success: true, deleted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "logout") {
      const existing = await findExistingSession();
      if (existing?.id) {
        const outRes = await fetch(`${goServerUrl}/api/sessions/${encodeURIComponent(existing.id)}/logout`, {
          method: "POST",
          headers: goHeaders(goApiKey),
          signal: AbortSignal.timeout(20_000),
        });
        if (!outRes.ok && outRes.status !== 404) {
          throw new Error(`Failed to logout session (${outRes.status})`);
        }
      }
      return new Response(JSON.stringify({ success: true, state: "logged_out", paired: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "pair") {
      let existing = await findExistingSession();
      if (!existing) {
        const created = await createSession();
        const sid = created.id || created.session_id;
        // Wait briefly for initial QR snapshot if available
        await new Promise((r) => setTimeout(r, 800));
        existing = (await findExistingSession()) || { id: sid, state: "connecting", paired: false, qr: null };
      } else if (!existing.paired && existing.state !== "open") {
        const pairRes = await fetch(`${goServerUrl}/api/sessions/${encodeURIComponent(existing.id)}/pair`, {
          method: "POST",
          headers: goHeaders(goApiKey),
          signal: AbortSignal.timeout(15_000),
        });
        if (!pairRes.ok && pairRes.status !== 400) {
          const errText = await pairRes.text();
          throw new Error(`Failed to start QR pairing (${pairRes.status}): ${errText}`);
        }
        await new Promise((r) => setTimeout(r, 600));
        existing = (await findExistingSession()) || existing;
      }

      return new Response(
        JSON.stringify({
          success: true,
          session_id: existing.id,
          state: existing.state || "connecting",
          paired: Boolean(existing.paired),
          qr: existing.qr || null,
          jid: existing.jid || "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Default: "status" (fetches or provisions the business's voice session)
    const existing = await findExistingSession();
    if (existing) {
      return new Response(
        JSON.stringify({
          success: true,
          session_id: existing.id,
          state: existing.state || "logged_out",
          paired: Boolean(existing.paired),
          qr: existing.qr || null,
          jid: existing.jid || "",
          is_existing: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const created = await createSession();
    const newId = created.id || created.session_id;
    return new Response(
      JSON.stringify({
        success: true,
        session_id: newId,
        state: "connecting",
        paired: false,
        qr: null,
        jid: "",
        is_existing: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error in wa-pair-wacaller:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
