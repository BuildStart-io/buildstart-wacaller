import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar, Play } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { useStaffAccess } from "@/hooks/useStaffAccess";

export default function Schedule() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { roleLoading } = useRole();
  const { isStaff, hasPermission, loading: staffLoading } = useStaffAccess();

  const [numbersText, setNumbersText] = useState("");
  const [gapMinutes, setGapMinutes] = useState("1");
  const [testNumber, setTestNumber] = useState("");

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const numbers = numbersText
        .split(/[\n,]+/)
        .map(n => n.trim())
        .filter(n => n.length > 5);

      if (numbers.length === 0) {
        throw new Error("No valid phone numbers found");
      }

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/schedule-call-wacaller`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          numbers,
          gapMinutes: parseFloat(gapMinutes) || 1
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to schedule');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Successfully scheduled",
        description: `${data.count} calls have been added to the outbound queue.`,
      });
      setNumbersText("");
      queryClient.invalidateQueries({ queryKey: ['scheduled-calls'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Scheduling failed",
        description: error.message,
      });
    }
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!testNumber) throw new Error("Please enter a phone number");
      
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/schedule-call-wacaller`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          numbers: [testNumber],
          gapMinutes: 0
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to trigger test call');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Test Call Initiated",
        description: "The AI agent should call you momentarily.",
      });
      setTestNumber("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Test Call Failed",
        description: error.message,
      });
    }
  });

  if (roleLoading || staffLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Outbound Campaigns</h1>
            <p className="text-muted-foreground">Schedule AI voice calls to a bulk list of numbers.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Bulk Calls</CardTitle>
              <CardDescription>
                Paste a list of phone numbers (comma-separated or one per line).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="numbers">Phone Numbers</Label>
                <Textarea
                  id="numbers"
                  placeholder="e.g. +1234567890&#10;+0987654321"
                  className="min-h-[150px]"
                  value={numbersText}
                  onChange={(e) => setNumbersText(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gap">Time Gap between calls (minutes)</Label>
                <Input
                  id="gap"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={gapMinutes}
                  onChange={(e) => setGapMinutes(e.target.value)}
                />
              </div>
              <Button 
                onClick={() => scheduleMutation.mutate()} 
                disabled={scheduleMutation.isPending || !numbersText}
                className="w-full"
              >
                {scheduleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Calls
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Test Call</CardTitle>
              <CardDescription>
                Test your AI agent immediately on your own phone number.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test">Your Phone Number</Label>
                <Input
                  id="test"
                  placeholder="e.g. +1234567890"
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                />
              </div>
              <Button 
                variant="secondary"
                onClick={() => testMutation.mutate()} 
                disabled={testMutation.isPending || !testNumber}
                className="w-full"
              >
                {testMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Call Me Now
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Queue Status</CardTitle>
            <CardDescription>View upcoming and completed scheduled calls.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center p-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              <p>Fetching scheduled calls will be implemented here.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
