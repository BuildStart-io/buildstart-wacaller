import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOCAL_BASE_PROMPT = `You are a trusted voice sales consultant in Sri Lanka — calm, warm, confident, and genuinely helpful. You are not an FAQ bot, but you never sound pushy, overexcited, theatrical, or aggressive. Guide the call naturally, understand the customer, recommend the right fit, and agree on a useful next step.

VOICE AND DELIVERY
Speak at a relaxed, steady pace with a friendly Sri Lankan tone. Use moderate energy and restrained enthusiasm. Keep your pitch and volume even. Do not shout, rush, exaggerate, use hype, or sound like a scripted salesperson. Pause naturally, listen carefully, and acknowledge the customer's answer before asking the next question.

LANGUAGE
Speak natural Sinhala, Tamil, English, or authentic Singlish and Tanglish code-switching, matching the customer. If they mix languages, mix back naturally. If you did not hear clearly, ask them to repeat — never guess.

HARD RULES
1. Usually end with one relevant open question or a gentle two-option choice, but do not interrogate.
2. Keep each spoken sentence under about 20 words and use 1–2 sentences per turn. Use natural connectors sparingly: "හරි", "ඇත්තටම", "නේද?", "சரி".
3. Never dump feature lists. Give one relevant benefit, then ask.

BUSINESS KNOWLEDGE (STRICTLY ADHERE TO THIS):
`;

const LOCAL_PROMPT_MARKER = "BUSINESS KNOWLEDGE (STRICTLY ADHERE TO THIS):";
const DEFAULT_LOCAL_VOICE = "Aoede";
const DEFAULT_LOCAL_FALLBACK = "ආයුබෝවන්! ඔබ අප අමතන්නට උත්සාහ කළ බව දුටුවෙමි. අපගේ AI හඬ සහායකයා මේ මොහොතේම ඔබව නැවත අමතනු ඇත.";

function stripLocalBasePrompt(raw: string): string {
  if (!raw) return "";
  if (raw.startsWith(LOCAL_BASE_PROMPT)) {
    return raw.slice(LOCAL_BASE_PROMPT.length);
  }
  if (
    raw.includes("You are a trusted voice sales consultant in Sri Lanka") &&
    raw.includes(LOCAL_PROMPT_MARKER)
  ) {
    const idx = raw.indexOf(LOCAL_PROMPT_MARKER) + LOCAL_PROMPT_MARKER.length;
    return raw.slice(idx).replace(/^\r?\n/, "");
  }
  return raw;
}

function buildFullLocalPrompt(userPrompt: string): string {
  const cleanUserPrompt = stripLocalBasePrompt(userPrompt || "");
  return LOCAL_BASE_PROMPT + cleanUserPrompt;
}

function resolveLocalVoice(voiceModel?: string): string {
  const v = (voiceModel || "").trim();
  if (
    !v ||
    v.startsWith("models/") ||
    v.startsWith("dialog-") ||
    v.startsWith("piper-") ||
    v === "Kore"
  ) {
    return DEFAULT_LOCAL_VOICE;
  }
  return v;
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

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseWacaller = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: "wacaller_customization" } });

    // Check if the user is a staff member
    const { data: staffData } = await supabaseWacaller
      .from("staff_accounts")
      .select("owner_id")
      .eq("staff_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const businessId = staffData?.owner_id || user.id;
    const supabaseInfra = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: "whatsapp_infra" } });

    if (req.method === "GET") {
      const { data, error } = await supabaseInfra
        .from("agent_configs")
        .select("*")
        .eq("business_id", businessId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Supabase select error:", error);
        throw new Error(error.message);
      }

      const responseData = data
        ? {
            ...data,
            business_prompt: stripLocalBasePrompt(data.business_prompt || ""),
          }
        : {};

      return new Response(JSON.stringify({ success: true, data: responseData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // POST: compile full Sri Lanka system prompt + user knowledge and store Aoede voice
    const { business_prompt, greeting_message, fallback_message, voice_model } = await req.json();

    const compiledPrompt = buildFullLocalPrompt(business_prompt || "");
    const resolvedVoice = resolveLocalVoice(voice_model);
    const resolvedFallback =
      fallback_message && String(fallback_message).trim() !== ""
        ? String(fallback_message)
        : DEFAULT_LOCAL_FALLBACK;

    const { data, error } = await supabaseInfra
      .from("agent_configs")
      .upsert(
        {
          business_id: businessId,
          business_prompt: compiledPrompt,
          greeting_message: greeting_message || "",
          fallback_message: resolvedFallback,
          voice_model: resolvedVoice,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      )
      .select();

    if (error) {
      console.error("Supabase upsert error:", error);
      throw new Error(error.message);
    }

    const saved = data?.[0]
      ? {
          ...data[0],
          business_prompt: stripLocalBasePrompt(data[0].business_prompt || ""),
        }
      : {};

    return new Response(JSON.stringify({ success: true, data: saved }), {
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
