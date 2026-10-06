import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Smartphone, Wifi, WifiOff, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";

const GO_SERVER_URL = import.meta.env.VITE_GO_SERVER_URL || "https://buildstart-calling-agent.buildstart.io";

export default function VoiceAgentConnection() {
  const [sessionInfo, setSessionInfo] = useState<{ id: string, state: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
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

  // Fetch session on mount
  const fetchSessionStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-pair-wacaller`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to check session: ${response.status}`);
      }
      
      const data = await response.json();
      setSessionInfo({ id: data.session_id, state: data.state || "logged_out" });
    } catch (error: any) {
      console.error("Error fetching voice session:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessionStatus();
  }, [fetchSessionStatus]);

  // Extract QR code from any SSE event data
  const handleEventData = useCallback((data: any) => {
    if (!data || !sessionInfo?.id) return;

    const sessionId = sessionInfo.id;

    if ((data.type === "qr" || data.type === "session-qr") && data.qr) {
      if (!data.sessionId || !data.session_id || data.sessionId === sessionId || data.session_id === sessionId) {
        log(`QR received via ${data.type} event`);
        setQrCode(data.qr);
        qrFoundRef.current = true;
        return;
      }
    }

    if (data.type === "session-list" && Array.isArray(data.sessions)) {
      const mySession = data.sessions.find((s: any) => s.id === sessionId);
      if (mySession) {
        setSessionInfo({ id: sessionId, state: mySession.state });
        if (mySession.qr) {
          log("QR extracted from session-list");
          setQrCode(mySession.qr);
          qrFoundRef.current = true;
        }
        if (mySession.state === "open" || mySession.paired === true) {
          log("Session is paired!");
          setQrCode(null);
        }
      }
    }

    if ((data.type === "auth-state" || data.type === "state" || data.type === "session-state") &&
        (data.sessionId === sessionId || data.session_id === sessionId)) {
      setSessionInfo({ id: sessionId, state: data.state });
      if (data.state === "open" || data.paired === true) {
        setQrCode(null);
        toast({
          title: "Voice Agent Connected",
          description: "Your WhatsApp number is now successfully linked to the voice agent."
        });
      }
      if (data.qr && data.state === "qr") {
        log("QR extracted from auth-state event");
        setQrCode(data.qr);
        qrFoundRef.current = true;
      }
    }
  }, [sessionInfo?.id, log, toast]);

  const startPairing = async () => {
    if (!sessionInfo?.id) return;
    setQrLoading(true);
    setQrCode(null);
    qrFoundRef.current = false;
    setDebugInfo("");
    log("Starting pairing flow...");

    // Setup SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    log(`Connecting SSE to ${GO_SERVER_URL}/api/events?session_id=${sessionInfo.id}`);
    const eventSource = new EventSource(`${GO_SERVER_URL}/api/events?session_id=${sessionInfo.id}`);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => log("SSE connection opened");
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleEventData(data);
      } catch (e) {
        log(`SSE parse error: ${e}`);
      }
    };
    eventSource.onerror = (error) => {
      if (eventSource.readyState === EventSource.CLOSED) {
        log("SSE connection closed permanently, relying on polling fallback");
      }
    };

    // Setup Polling Fallback
    if (pollingRef.current) clearInterval(pollingRef.current);
    
    const poll = async () => {
      try {
        const res = await fetch(`${GO_SERVER_URL}/api/sessions`, {
          headers: { "Accept": "application/json" }
        });
        if (!res.ok) return;
        const data = await res.json();
        const mySession = (data.sessions || []).find((s: any) => s.id === sessionInfo.id);
        if (mySession) {
          setSessionInfo({ id: sessionInfo.id, state: mySession.state });
          if (mySession.qr && !qrFoundRef.current) {
            log(`POLL: QR found for session ${sessionInfo.id}`);
            setQrCode(mySession.qr);
            qrFoundRef.current = true;
          }
          if (mySession.state === "open" || mySession.paired === true) {
            setQrCode(null);
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        }
      } catch (e: any) {}
    };

    const initialTimeout = setTimeout(poll, 2000);
    pollingRef.current = setInterval(poll, 3000);
  };

  const deleteSession = async () => {
    if (!sessionInfo?.id) return;
    if (!confirm("Are you sure you want to disconnect and delete this voice session?")) return;
    
    try {
      const response = await fetch(`${GO_SERVER_URL}/api/sessions/${sessionInfo.id}`, {
        method: "DELETE"
      }).catch(e => null); // catch network errors so we can fallback

      // Fallback: forcefully delete from Supabase if Go server failed, returned error, or was unreachable
      if (!response || !response.ok) {
        console.warn("Go server delete failed or unreachable, forcefully deleting session from Supabase CRM.");
        await supabase.from("whatsapp_sessions").delete().eq("id", sessionInfo.id);
      }

      toast({ title: "Session deleted", description: "Voice agent session has been removed." });
      setSessionInfo(null);
      setQrCode(null);
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (pollingRef.current) clearInterval(pollingRef.current);
      // Re-fetch to create a new empty one
      fetchSessionStatus();
    } catch (e: any) {
      toast({ title: "Error deleting session", description: e.message, variant: "destructive" });
    }
  };

  // Clean up when connected or unmounting
  useEffect(() => {
    const isConnected = sessionInfo?.state === "open" || sessionInfo?.state === "connected";
    if (isConnected) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  }, [sessionInfo?.state]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "connected":
      case "open":
      case "paired":
        return "bg-green-100 text-green-800";
      case "disconnected":
      case "offline":
      case "logged_out":
        return "bg-red-100 text-red-800";
      case "connecting":
      case "initializing":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const isConnected = sessionInfo?.state === "open" || sessionInfo?.state === "connected" || sessionInfo?.state === "paired";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!sessionInfo ? (
        <div className="text-center py-8">
          <Smartphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No Voice session available. Please contact support.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Active Voice Agent Session</h4>
          <div className="grid gap-3">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {isConnected ? (
                  <Wifi className="h-5 w-5 text-green-600" />
                ) : (
                  <WifiOff className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">Primary Voice Line</p>
                  <p className="text-sm text-muted-foreground">ID: {sessionInfo.id.substring(0, 8)}...</p>
                </div>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sessionInfo.state)}`}>
                  {isConnected ? "Connected" : sessionInfo.state || "Unknown"}
                </span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                {!isConnected && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-initial"
                    onClick={startPairing}
                    disabled={qrLoading && !qrCode}
                  >
                    {qrLoading && !qrCode ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">
                      {qrCode ? "Regenerate QR" : "Get QR Code"}
                    </span>
                    <span className="sm:hidden">
                      {qrCode ? "Regen" : "QR"}
                    </span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={deleteSession}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Display */}
      {(!isConnected && qrCode) && (
        <div className="border rounded-lg p-6 text-center space-y-4">
          <h4 className="font-medium">Scan this QR Code with WhatsApp</h4>
          <div className="flex justify-center bg-white p-4 rounded-lg inline-block mx-auto">
            <QRCodeSVG value={qrCode} size={256} />
          </div>
          <ol className="text-sm text-muted-foreground text-left max-w-sm mx-auto space-y-2 list-decimal list-inside">
            <li>Open WhatsApp on your phone</li>
            <li>Go to <strong>Settings</strong></li>
            <li>Tap <strong>Linked Devices</strong></li>
            <li>Tap <strong>Link a Device</strong> and point your camera at this screen</li>
          </ol>
        </div>
      )}
      
      {(!isConnected && qrLoading && !qrCode) && (
        <div className="text-center py-12 border rounded-lg">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="font-medium">Connecting to Voice Server...</p>
          <p className="text-sm text-muted-foreground mt-2">Please wait while we generate your secure QR code.</p>
          {debugInfo && (
            <pre className="mt-4 text-xs text-left bg-muted/50 p-3 rounded max-w-md mx-auto overflow-auto max-h-32 font-mono">
              {debugInfo}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
