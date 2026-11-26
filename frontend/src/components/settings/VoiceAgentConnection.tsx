import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Smartphone, Wifi, WifiOff, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";

type VoiceSessionState = {
  id: string;
  state: string;
  paired: boolean;
  jid?: string;
};

export default function VoiceAgentConnection() {
  const [sessionInfo, setSessionInfo] = useState<VoiceSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const { toast } = useToast();

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartedAtRef = useRef<number>(0);

  const log = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    setDebugInfo((prev) => `${ts}: ${msg}\n${prev}`.slice(0, 1000));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const callPairFunction = useCallback(async (action: "status" | "pair" | "logout" | "delete") => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Authentication required");
    }
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wa-pair-wacaller`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Voice session request failed (${response.status})`);
    }
    return response.json();
  }, []);

  const applyStatusResponse = useCallback(
    (data: any, notifyOnConnect = false) => {
      if (!data?.session_id) return false;
      const connected = data.state === "open" || data.state === "connected" || data.paired === true;
      setSessionInfo({
        id: data.session_id,
        state: data.state || (connected ? "open" : "logged_out"),
        paired: Boolean(data.paired || connected),
        jid: data.jid || "",
      });
      if (connected) {
        setQrCode(null);
        setQrLoading(false);
        stopPolling();
        if (notifyOnConnect) {
          toast({
            title: "Voice Agent Connected",
            description: "Your WhatsApp number is now successfully linked to the voice agent.",
          });
        }
        return true;
      }
      if (data.qr) {
        setQrCode(data.qr);
        setQrLoading(false);
      }
      return false;
    },
    [stopPolling, toast]
  );

  const fetchSessionStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callPairFunction("status");
      applyStatusResponse(data, false);
    } catch (error: any) {
      console.error("Error fetching voice session:", error);
    } finally {
      setLoading(false);
    }
  }, [callPairFunction, applyStatusResponse]);

  useEffect(() => {
    fetchSessionStatus();
    return () => stopPolling();
  }, [fetchSessionStatus, stopPolling]);

  const startPairing = async () => {
    if (!sessionInfo?.id) return;
    stopPolling();
    setQrLoading(true);
    setQrCode(null);
    setDebugInfo("");
    pollStartedAtRef.current = Date.now();
    log("Requesting QR code through secure CRM proxy...");

    try {
      const data = await callPairFunction("pair");
      const connected = applyStatusResponse(data, true);
      if (connected) return;
      if (data.qr) {
        log("QR code received.");
      } else {
        log("Waiting for QR code generation...");
      }
    } catch (e: any) {
      log(`Pairing request error: ${e.message || e}`);
      toast({
        title: "Failed to request QR code",
        description: e.message || "Please try again.",
        variant: "destructive",
      });
      setQrLoading(false);
      return;
    }

    pollingRef.current = setInterval(async () => {
      if (Date.now() - pollStartedAtRef.current > 180_000) {
        stopPolling();
        setQrLoading(false);
        setQrCode(null);
        toast({
          title: "QR pairing timed out",
          description: "Click Get QR Code to generate a fresh QR.",
        });
        return;
      }
      try {
        const data = await callPairFunction("status");
        applyStatusResponse(data, true);
      } catch {
        // Keep polling briefly across transient network blips
      }
    }, 2000);
  };

  const deleteSession = async () => {
    if (!sessionInfo?.id) return;
    if (!confirm("Are you sure you want to disconnect and delete this voice session?")) return;

    try {
      await callPairFunction("delete");
      toast({ title: "Session deleted", description: "Voice agent session has been removed." });
      setSessionInfo(null);
      setQrCode(null);
      setQrLoading(false);
      stopPolling();
      fetchSessionStatus();
    } catch (e: any) {
      toast({ title: "Error deleting session", description: e.message, variant: "destructive" });
    }
  };

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
      case "qr":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const isConnected =
    sessionInfo?.paired === true ||
    sessionInfo?.state === "open" ||
    sessionInfo?.state === "connected" ||
    sessionInfo?.state === "paired";

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
          <p className="text-muted-foreground">No Voice session available. Please contact support.</p>
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
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                    sessionInfo.state
                  )}`}
                >
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
                    <span className="hidden sm:inline">{qrCode ? "Regenerate QR" : "Get QR Code"}</span>
                    <span className="sm:hidden">{qrCode ? "Regen" : "QR"}</span>
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
      {!isConnected && qrCode && (
        <div className="border rounded-lg p-6 text-center space-y-4">
          <h4 className="font-medium">Scan this QR Code with WhatsApp</h4>
          <div className="flex justify-center bg-white p-4 rounded-lg inline-block mx-auto">
            <QRCodeSVG value={qrCode} size={256} />
          </div>
          <ol className="text-sm text-muted-foreground text-left max-w-sm mx-auto space-y-2 list-decimal list-inside">
            <li>Open WhatsApp on your phone</li>
            <li>
              Go to <strong>Settings</strong>
            </li>
            <li>
              Tap <strong>Linked Devices</strong>
            </li>
            <li>
              Tap <strong>Link a Device</strong> and point your camera at this screen
            </li>
          </ol>
        </div>
      )}

      {!isConnected && qrLoading && !qrCode && (
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
