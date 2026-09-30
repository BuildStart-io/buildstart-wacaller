import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Bot, RefreshCw } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { useStaffAccess } from "@/hooks/useStaffAccess";

export default function Agent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { roleLoading } = useRole();
  const { isStaff, hasPermission, loading: staffLoading } = useStaffAccess();

  const [businessPrompt, setBusinessPrompt] = useState("");
  const [greetingMessage, setGreetingMessage] = useState("");
  const [fallbackMessage, setFallbackMessage] = useState("");

  const { data: businessId, isLoading: idLoading } = useQuery({
    queryKey: ['businessId'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from('users')
        .select('business_id')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data?.business_id;
    }
  });

  const { data: agentConfig, isLoading: configLoading } = useQuery({
    queryKey: ['agentConfig', businessId],
    enabled: !!businessId,
    queryFn: async () => {
      // Because agent_configs is in a private schema (whatsapp_infra),
      // we need to fetch it via an edge function or a secure view.
      // Wait, we didn't create a GET edge function for the config!
      // But the sync edge function Upserts it. We might need a secure way to get it,
      // or we just fetch it through a new edge function.
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-sync-wacaller`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch agent config");
      return response.json();
    }
  });

  useEffect(() => {
    if (agentConfig?.data) {
      setBusinessPrompt(agentConfig.data.business_prompt || "");
      setGreetingMessage(agentConfig.data.greeting_message || "");
      setFallbackMessage(agentConfig.data.fallback_message || "");
    }
  }, [agentConfig]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-sync-wacaller`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          business_prompt: businessPrompt,
          greeting_message: greetingMessage,
          fallback_message: fallbackMessage
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Successfully synchronized",
        description: "Your AI agent configuration has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['agentConfig'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: error.message,
      });
    }
  });

  const generateFaqSync = async () => {
    try {
      toast({ title: "Syncing Knowledge Base...", description: "Fetching Products and FAQs..." });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const [productsRes, faqsRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).neq('add_to_calling_agent', false),
        supabase.from('faqs').select('*').eq('is_active', true).neq('add_to_calling_agent', false)
      ]);
      
      if (productsRes.error) throw productsRes.error;
      if (faqsRes.error) throw faqsRes.error;
      
      let knowledgeBase = "\n\n--- BUSINESS KNOWLEDGE (AUTO-GENERATED) ---\n";
      
      if (productsRes.data && productsRes.data.length > 0) {
        knowledgeBase += "[Products & Services]\n";
        productsRes.data.forEach(p => {
          knowledgeBase += `- ${p.name}: LKR ${p.price} (Type: ${p.product_type})`;
          if (p.description) knowledgeBase += ` - ${p.description}`;
          knowledgeBase += "\n";
        });
        knowledgeBase += "\n";
      }
      
      if (faqsRes.data && faqsRes.data.length > 0) {
        knowledgeBase += "[Frequently Asked Questions]\n";
        faqsRes.data.forEach(f => {
          knowledgeBase += `- Q: ${f.question} | A: ${f.answer}\n`;
        });
      }
      knowledgeBase += "-------------------------------------------\n";

      const markerStart = "--- BUSINESS KNOWLEDGE (AUTO-GENERATED) ---";
      const markerEnd = "-------------------------------------------";
      
      let newPrompt = businessPrompt;
      const startIndex = newPrompt.indexOf(markerStart);
      
      if (startIndex !== -1) {
        const endIndex = newPrompt.indexOf(markerEnd, startIndex);
        if (endIndex !== -1) {
          newPrompt = newPrompt.substring(0, startIndex).trim() + knowledgeBase + newPrompt.substring(endIndex + markerEnd.length).trim();
        } else {
          newPrompt = newPrompt.trim() + knowledgeBase;
        }
      } else {
        newPrompt = newPrompt.trim() + knowledgeBase;
      }
      
      setBusinessPrompt(newPrompt);
      toast({ title: "Knowledge base synced", description: "Review the system prompt and click Save & Sync Server." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Sync failed", description: error.message });
    }
  };

  if (idLoading || roleLoading || staffLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Permission check
  if (isStaff && !hasPermission('settings')) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-muted-foreground">
          You don't have permission to manage the AI Agent.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Voice Agent</h1>
            <p className="text-muted-foreground">Configure the behavior, knowledge, and greetings of your WhatsApp calling agent.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={generateFaqSync}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync FAQs
            </Button>
            <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              {syncMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Bot className="w-4 h-4 mr-2" />
              Save & Sync Server
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System Prompt & Knowledge</CardTitle>
            <CardDescription>
              Define the AI's core instructions, business context, and facts it should know. 
              Do not include generic AI behavior rules (like tone or call pacing)—the server handles that automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">Business Knowledge (System Prompt)</Label>
                <Textarea
                  id="prompt"
                  placeholder="e.g. You are the receptionist for BuildStart. Our address is 123 Main St. We are open from 9 AM to 5 PM..."
                  className="min-h-[250px] font-mono text-sm"
                  value={businessPrompt}
                  onChange={(e) => setBusinessPrompt(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Call Handling</CardTitle>
            <CardDescription>
              Configure what the AI says when picking up a call, and the fallback text message it sends when missing a call.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="greeting">Initial Greeting Message</Label>
              <Input
                id="greeting"
                placeholder="Hello! Welcome to BuildStart. How can I help you today?"
                value={greetingMessage}
                onChange={(e) => setGreetingMessage(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This is the very first sentence the AI speaks when answering an inbound call or starting an outbound call.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fallback">Missed Call Fallback Message (Text)</Label>
              <Textarea
                id="fallback"
                placeholder="Hi, I noticed you tried to call. Our AI voice assistant will call you back shortly!"
                value={fallbackMessage}
                onChange={(e) => setFallbackMessage(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This WhatsApp text message is automatically sent if the user calls and the server drops it (e.g. if the system is busy), right before initiating the auto-callback.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
