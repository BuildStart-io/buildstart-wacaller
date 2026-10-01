import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";

const GO_SERVER_URL = import.meta.env.VITE_GO_SERVER_URL || "https://buildstart-calling-agent.buildstart.io";

export default function VoiceAgentConnection() {
  const [pairing, setPairing] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const { toast } = useToast();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const qrFoundRef = useRef(false);

  const log = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    console.log(`[VoiceAgent ${ts}] ${msg}`);
    setDebugInfo(prev => `${ts}: ${msg}\n${prev}`.slice(0, 1000));
  }, []);

  // Extract QR code from any SSE event data
  const handleEventData = useCallback((data: any) => {
    if (!data || !sessionId) return;

    // Direct QR event (session-qr or qr type)
    if ((data.type === "qr" || data.type === "session-qr") && data.qr) {
      // Only accept QR for OUR session
      if (!data.sessionId || !data.session_id || data.sessionId === sessionId || data.session_id === sessionId) {
        log(`QR received via ${data.type} event`);
        setQrCode(data.qr);
        qrFoundRef.current = true;
        return;
      }
    }

    // session-list: extract QR from the sessions array
    if (data.type === "session-list" && Array.isArray(data.sessions)) {
      const mySession = data.sessions.find((s: any) => s.id === sessionId);
      if (mySession) {
        log(`Found our session in session-list: state=${mySession.state}, hasQR=${!!mySession.qr}`);
        if (mySession.qr) {
          log("QR extracted from session-list");
          setQrCode(mySession.qr);
          qrFoundRef.current = true;
        }
        if (mySession.state === "open" || mySession.paired === true) {
          log("Session is paired!");
          setConnected(true);
          setQrCode(null);
          setPairing(false);
        }
      }
    }

    // auth-state / state events - only for OUR session
    if ((data.type === "auth-state" || data.type === "state" || data.type === "session-state") &&
        (data.sessionId === sessionId || data.session_id === sessionId)) {
      log(`Auth state for our session: state=${data.state}, paired=${data.paired}`);
      if (data.state === "open" || data.paired === true) {
        setConnected(true);
        setQrCode(null);
        setPairing(false);
        toast({
          title: "Voice Agent Connected",
          description: "Your WhatsApp number is now successfully linked to the voice agent."
        });
      }
      // Extract QR from auth-state too
      if (data.qr && data.state === "qr") {
        log("QR extracted from auth-state event");
        setQrCode(data.qr);
        qrFoundRef.current = true;
      }
    }
  }, [sessionId, log, toast]);

  const startPairing = async () => {
    setPairing(true);
    setQrCode(null);
    qrFoundRef.current = false;
    setDebugInfo("");
    log("Starting pairing flow...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      log(`Calling edge function at ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-pair-wacaller`);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-pair-wacaller`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`
        }
      });
      
      if (!response.ok) {
        const errText = await response.text();
        log(`Edge function error: ${response.status} ${errText}`);
        throw new Error(`Failed to initialize session: ${response.status}`);
      }
      
      const data = await response.json();
      log(`Session created: ${data.session_id}`);
      setSessionId(data.session_id);
    } catch (error: any) {
      log(`Error: ${error.message}`);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: error.message
      });
      setPairing(false);
    }
  };

  // SSE connection
  useEffect(() => {
    if (!sessionId) return;
    
    log(`Connecting SSE to ${GO_SERVER_URL}/api/events?session_id=${sessionId}`);
    const eventSource = new EventSource(`${GO_SERVER_URL}/api/events?session_id=${sessionId}`);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      log("SSE connection opened");
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        log(`SSE event: type=${data.type}`);
        handleEventData(data);
      } catch (e) {
        log(`SSE parse error: ${e}`);
      }
    };

    eventSource.onerror = (error) => {
      log(`SSE error (readyState=${eventSource.readyState})`);
      // readyState 2 = CLOSED, means it won't reconnect
      if (eventSource.readyState === EventSource.CLOSED) {
        log("SSE connection closed permanently, relying on polling fallback");
      }
    };

    return () => {
      log("Cleaning up SSE connection");
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [sessionId, handleEventData, log]);

  // Polling fallback - polls session info every 3 seconds
  useEffect(() => {
    if (!sessionId) return;

    log("Starting polling fallback (every 3s)");
    const poll = async () => {
      try {
        const res = await fetch(`${GO_SERVER_URL}/api/sessions`, {
          headers: { "Accept": "application/json" }
        });
        if (!res.ok) {
          log(`Poll failed: ${res.status}`);
          return;
        }
        const data = await res.json();
        const sessions = data.sessions || [];
        const mySession = sessions.find((s: any) => s.id === sessionId);
        if (mySession) {
          if (mySession.qr && !qrFoundRef.current) {
            log(`POLL: QR found for session ${sessionId}`);
            setQrCode(mySession.qr);
            qrFoundRef.current = true;
          }
          if (mySession.state === "open" || mySession.paired === true) {
            log("POLL: Session is paired!");
            setConnected(true);
            setQrCode(null);
            setPairing(false);
          }
        }
      } catch (e: any) {
        log(`Poll error: ${e.message}`);
      }
    };

    // First poll after 2 seconds to give SSE a chance first
    const initialTimeout = setTimeout(poll, 2000);
    pollingRef.current = setInterval(poll, 3000);

    return () => {
      clearTimeout(initialTimeout);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [sessionId, log]);

  // Clean up polling when connected or QR found
  useEffect(() => {
    if (connected && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (connected && eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, [connected]);

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
              {debugInfo && (
                <pre className="mt-4 text-xs text-left bg-muted/50 p-3 rounded max-w-md overflow-auto max-h-32 font-mono">
                  {debugInfo}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
