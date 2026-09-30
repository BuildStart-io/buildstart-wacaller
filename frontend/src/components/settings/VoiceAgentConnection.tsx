import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";

export default function VoiceAgentConnection() {
  const [pairing, setPairing] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { toast } = useToast();

  const startPairing = async () => {
    setPairing(true);
    setQrCode(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-pair-wacaller`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`
        }
      });
      
      if (!response.ok) {
        throw new Error("Failed to initialize session on voice server.");
      }
      
      const data = await response.json();
      setSessionId(data.session_id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: error.message
      });
      setPairing(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    
    // Connect to SSE for QR code streaming
    // Use the GO_SERVER_URL env or fallback to a default
    const goServerUrl = import.meta.env.VITE_GO_SERVER_URL || "https://wacaller.bandara.me";
    const eventSource = new EventSource(`${goServerUrl}/api/events?session_id=${sessionId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "qr") {
          setQrCode(data.qr);
        } else if (data.type === "state") {
          if (data.state === "open" || data.paired === true) {
            setConnected(true);
            setQrCode(null);
            setPairing(false);
            eventSource.close();
            toast({
              title: "Voice Agent Connected",
              description: "Your WhatsApp number is now successfully linked to the voice agent."
            });
          } else if (data.state === "logged_out") {
            setConnected(false);
            setPairing(false);
            eventSource.close();
          }
        }
      } catch (e) {
        console.error("SSE parse error", e);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE error", error);
      // Wait, we don't necessarily close it on error, might just reconnect,
      // but if it fails completely we can reset state.
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId, toast]);

  if (connected) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border rounded-lg bg-green-50/50 dark:bg-green-950/20">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
          <Smartphone className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-xl font-semibold text-green-700 dark:text-green-300">Voice Agent is Connected!</h3>
        <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-2 text-center max-w-md">
          Your WhatsApp number is successfully linked. The AI voice agent will now answer and make calls using this number.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!pairing && !qrCode ? (
        <div className="text-center p-8 border rounded-lg">
          <Smartphone className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">Link Voice Agent</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mt-2 mb-6">
            To allow the AI to make and receive voice calls, you must link it to a WhatsApp number. Click below to generate a QR code.
          </p>
          <Button onClick={startPairing}>
            Generate QR Code
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 border rounded-lg">
          {qrCode ? (
            <>
              <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
                <QRCodeSVG value={qrCode} size={256} />
              </div>
              <h3 className="text-lg font-medium mb-2">Scan this QR Code with WhatsApp</h3>
              <ol className="text-sm text-muted-foreground text-left max-w-sm space-y-2 list-decimal list-inside">
                <li>Open WhatsApp on your phone</li>
                <li>Go to <strong>Settings</strong></li>
                <li>Tap <strong>Linked Devices</strong></li>
                <li>Tap <strong>Link a Device</strong> and point your camera at this screen</li>
              </ol>
            </>
          ) : (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <p className="font-medium">Connecting to Voice Server...</p>
              <p className="text-sm text-muted-foreground mt-2">Please wait while we generate your secure QR code.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
