import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, PhoneCall, PhoneIncoming, PhoneOutgoing, Clock, Bot } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type CallRecord = {
  id: string;
  session_id: string;
  caller_number: string;
  direction: string;
  started_at: string;
  duration: number;
  status: string;
  transcript_json: any[];
};

export default function Calls() {
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['voice-calls'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-calls-wacaller`, {
        headers: {
          "Authorization": `Bearer ${session?.access_token}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch calls");
      const resData = await response.json();
      return resData.calls as CallRecord[];
    }
  });

  const formatDuration = (seconds: number) => {
    if (!seconds) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-theme(spacing.16))] sm:h-screen overflow-hidden bg-background">
        {/* Left pane - Call List */}
        <div className={cn(
          "w-full sm:w-[350px] lg:w-[400px] flex-shrink-0 flex flex-col border-r bg-card relative transition-all duration-300",
          selectedCall ? "hidden sm:flex" : "flex"
        )}>
          <div className="p-4 border-b">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-primary" />
              Voice Calls
            </h1>
          </div>
          
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex h-full items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : calls.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No voice calls recorded yet.
              </div>
            ) : (
              <div className="divide-y">
                {calls.map((call) => (
                  <button
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className={cn(
                      "w-full text-left p-4 hover:bg-accent/50 transition-colors flex items-start gap-3",
                      selectedCall?.id === call.id && "bg-accent"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-full",
                      call.direction === "inbound" ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
                    )}>
                      {call.direction === "inbound" ? (
                        <PhoneIncoming className="w-4 h-4" />
                      ) : (
                        <PhoneOutgoing className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold truncate">
                          {call.caller_number || "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          {format(new Date(call.started_at), 'MMM d, p')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span className="capitalize">{call.status}</span>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(call.duration)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right pane - Transcript */}
        <div className={cn(
          "flex-1 flex flex-col bg-background/50 relative",
          !selectedCall ? "hidden sm:flex" : "flex"
        )}>
          {selectedCall ? (
            <>
              <div className="h-16 flex items-center px-4 border-b bg-card justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSelectedCall(null)}
                    className="sm:hidden p-2 -ml-2 rounded-md hover:bg-accent"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <div>
                    <h2 className="font-semibold">{selectedCall.caller_number || "Unknown"}</h2>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(selectedCall.started_at), 'PPP p')} • {formatDuration(selectedCall.duration)}
                    </p>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="max-w-3xl mx-auto space-y-6 pb-4">
                  {(!selectedCall.transcript_json || selectedCall.transcript_json.length === 0) ? (
                    <div className="text-center p-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                      No transcript available for this call.
                    </div>
                  ) : (
                    (() => {
                      let transcripts = selectedCall.transcript_json;
                      if (typeof transcripts === 'string') {
                        try {
                          transcripts = JSON.parse(transcripts);
                        } catch (e) {
                          transcripts = [];
                        }
                      }
                      if (!Array.isArray(transcripts)) {
                        transcripts = [];
                      }

                      const aggregatedTranscripts: any[] = [];
                      transcripts.forEach((msg) => {
                        if (!msg) return;
                        if (aggregatedTranscripts.length > 0) {
                          const lastMsg = aggregatedTranscripts[aggregatedTranscripts.length - 1];
                          if (lastMsg.role === msg.role) {
                            lastMsg.text += " " + (msg.text || "");
                            return;
                          }
                        }
                        aggregatedTranscripts.push({ ...msg, text: msg.text || "" });
                      });

                      return aggregatedTranscripts.map((msg, i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex w-full gap-3",
                            msg.role === 'agent' || msg.role === 'assistant' ? "justify-end" : "justify-start"
                          )}
                        >
                          {(msg.role !== 'agent' && msg.role !== 'assistant') && (
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                              <span className="text-blue-700 text-xs font-bold">U</span>
                            </div>
                          )}
                          <div
                            className={cn(
                              "px-4 py-3 rounded-2xl max-w-[80%]",
                              msg.role === 'agent' || msg.role === 'assistant'
                                ? "bg-primary text-primary-foreground rounded-tr-sm"
                                : "bg-muted rounded-tl-sm"
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                            <div className={cn(
                              "text-[10px] mt-2 opacity-70",
                              msg.role === 'agent' || msg.role === 'assistant' ? "text-right" : "text-left"
                            )}>
                              {msg.role === 'agent' || msg.role === 'assistant' ? 'AI Agent' : 'User'}
                            </div>
                          </div>
                          {(msg.role === 'agent' || msg.role === 'assistant') && (
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                              <Bot className="w-4 h-4 text-primary" />
                            </div>
                          )}
                        </div>
                      ));
                    })()
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <PhoneCall className="w-8 h-8 opacity-20" />
              </div>
              <p className="text-lg font-medium">Select a call</p>
              <p className="text-sm text-center max-w-sm mt-2 opacity-80">
                Choose a voice call from the list to view its transcript and details.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
