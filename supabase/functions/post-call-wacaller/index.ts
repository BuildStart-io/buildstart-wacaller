import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface TranscriptItem {
  timestamp?: number;
  role: string;
  text: string;
}

interface LeadDossier {
  business_name?: string;
  caller_role?: string;
  identified_pain_points?: string[];
  recommended_plan?: string;
  objections_raised?: string;
  deal_temperature?: string;
  lead_score?: string;
  whatsapp_summary_sinhala?: string;
  next_action?: string;
}

async function loadSecrets() {
  let fileSecrets: Record<string, string> = {};
  try {
    const mod = await import("./_secrets.ts");
    fileSecrets = mod.SECRETS || mod.default || {};
  } catch {
    // Optional local _secrets.ts module; fallback to Deno.env
  }
  return {
    webhookSecret: Deno.env.get("POST_CALL_WEBHOOK_SECRET") || fileSecrets.POST_CALL_WEBHOOK_SECRET || "",
    goApiKey: Deno.env.get("GO_API_KEY") || fileSecrets.GO_API_KEY || "",
    goServerUrl: (
      Deno.env.get("GO_SERVER_URL") ||
      fileSecrets.GO_SERVER_URL ||
      "https://buildstart-calling-agent.buildstart.io"
    ).replace(/\/+$/, ""),
  };
}

function extractJsonObject(raw: string): LeadDossier | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const secrets = await loadSecrets();
    if (!secrets.webhookSecret) {
      return new Response(JSON.stringify({ error: "POST_CALL_WEBHOOK_SECRET is not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const provided = req.headers.get("x-webhook-secret") || "";
    if (provided !== secrets.webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized webhook" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const {
      call_id: callId,
      session_id: sessionId,
      business_id: businessId,
      caller_number: callerNumber,
      peer_jid: peerJid,
      transcripts,
    } = payload || {};

    if (!sessionId || !businessId || !Array.isArray(transcripts) || transcripts.length < 2) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Insufficient transcript turns or missing session/business" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify business_id belongs to this Local CRM Supabase instance
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userLookup, error: userErr } = await supabaseAdmin.auth.admin.getUserById(businessId);
    if (userErr || !userLookup?.user) {
      console.log(`[post-call-wacaller] Skipping non-local business_id=${businessId}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "business_not_in_local_crm" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcriptText = (transcripts as TranscriptItem[])
      .map((t) => {
        const role = t.role === "assistant" || t.role === "agent" ? "Buildstart AI" : "Customer";
        return `${role}: ${t.text}`;
      })
      .join("\n");

    const prompt = `You are the Senior Lead Intelligence AI for Buildstart (a WhatsApp CRM & Voice Automation software in Sri Lanka).
Analyze this live WhatsApp phone call transcript between our AI Voice Consultant and the caller:

TRANSCRIPT:
${transcriptText}

Generate a comprehensive CRM Lead Dossier in STRICT JSON format with these exact keys:
{
  "business_name": "<Short description of business or store, e.g. Clothing Retailer in Colombo>",
  "caller_role": "<e.g. Business Owner / Manager / Customer>",
  "identified_pain_points": ["<Pain point 1>", "<Pain point 2>"],
  "recommended_plan": "<Recommended Buildstart Plan e.g. Starter (LKR 6,990) / Business (LKR 12,990) / Enterprise>",
  "objections_raised": "<Any objection, budget worry, or decision delay>",
  "deal_temperature": "<🔥 Hot Lead / 🟡 Warm Lead / ❄️ Cold Lead>",
  "lead_score": "<e.g. 8.5/10>",
  "whatsapp_summary_sinhala": "<Polite, personalized 2-3 sentence WhatsApp follow-up message in Sinhala thanking them, summarizing the package discussed, and offering a direct link or quick reply. Do NOT use markdown asterisks or robotic phrases.>",
  "next_action": "<Recommended next step for human sales team>"
}
Return ONLY valid JSON.`;

    const aiGenerateUrl = Deno.env.get("AI_GENERATE_URL");
    const botApiKey = Deno.env.get("BOT_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
    const model = "google/gemini-3-flash-preview";
    const messages = [{ role: "user", content: prompt }];

    let aiRes: Response;
    if (aiGenerateUrl && botApiKey) {
      aiRes = await fetch(aiGenerateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bot-key": botApiKey },
        body: JSON.stringify({ messages, model, maxTokens: 700 }),
      });
    } else if (lovableApiKey) {
      aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, messages, max_tokens: 700 }),
      });
    } else if (openRouterKey) {
      aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, max_tokens: 700 }),
      });
    } else {
      throw new Error("No AI provider credentials configured");
    }

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error(`[post-call-wacaller] AI error [${aiRes.status}]:`, errText);
      throw new Error(`AI generation failed (${aiRes.status})`);
    }

    const aiData = await aiRes.json();
    const rawContent = aiData.text || aiData.choices?.[0]?.message?.content || "";
    const dossier = extractJsonObject(rawContent);
    if (!dossier) {
      console.error("[post-call-wacaller] Failed to parse dossier JSON:", rawContent);
      throw new Error("Failed to parse lead dossier JSON");
    }

    console.log(
      `[post-call-wacaller] Lead Dossier generated call_id=${callId} temp=${dossier.deal_temperature} score=${dossier.lead_score}`
    );

    const target = peerJid || callerNumber || "";
    let messageSent = false;
    if (dossier.whatsapp_summary_sinhala && target) {
      // Short pause so caller has hung up cleanly before receiving the follow-up message
      await new Promise((r) => setTimeout(r, 3000));

      const sendHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (secrets.goApiKey) {
        sendHeaders["X-Api-Key"] = secrets.goApiKey;
      }

      const sendRes = await fetch(`${secrets.goServerUrl}/api/sessions/${encodeURIComponent(sessionId)}/messages/send`, {
        method: "POST",
        headers: sendHeaders,
        body: JSON.stringify({
          to: target,
          text: dossier.whatsapp_summary_sinhala,
        }),
      });

      if (!sendRes.ok) {
        const sendErr = await sendRes.text();
        console.error(`[post-call-wacaller] Go send message failed [${sendRes.status}]:`, sendErr);
      } else {
        messageSent = true;
      }
    }

    return new Response(
      JSON.stringify({ success: true, call_id: callId, dossier, message_sent: messageSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in post-call-wacaller:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
