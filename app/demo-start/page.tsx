'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LanguageSelector } from "@/components/LanguageSelector";
import { toast } from "sonner";
import { Loader2, MessageSquare, Globe } from "lucide-react";

/**
 * Direct entry point for starting a dual-pane demo chat
 * This page allows portal users to start a demo without seeing the dashboard
 */
function DemoStartContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [employeeLanguage, setEmployeeLanguage] = useState("en");
  const [customerLanguage, setCustomerLanguage] = useState("es");
  const [starting, setStarting] = useState(false);

  async function handleStartDemo() {
    if (!user) {
      toast.error("Please log in to start a demo");
      return;
    }

    try {
      setStarting(true);

      // Get employee name from user metadata or email
      const employeeName = user.user_metadata?.name || user.email?.split('@')[0] || 'Employee';

      // Create a new demo conversation
      const response = await fetch("/api/demo/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          employeeName: employeeName,
          language1: employeeLanguage,
          language2: customerLanguage,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start demo");
      }

      const data = await response.json();
      
      if (data.conversationId) {
        // Redirect to the dual-pane demo view
        router.push(`/demo/${data.conversationId}`);
      } else {
        throw new Error("No conversation ID returned");
      }
    } catch (error) {
      console.error("Error starting demo:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start demo");
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <Card className="max-w-2xl w-full p-8 bg-slate-900/50 border-slate-800">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 mb-4">
            <MessageSquare className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Translation Demo Chat
          </h1>
          <p className="text-slate-400">
            Experience real-time multi-language conversation translation
          </p>
        </div>

        <div className="space-y-6">
          {/* Employee Language Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <label className="text-sm font-medium text-white">
                Your Language (Employee)
              </label>
            </div>
            <LanguageSelector
              value={employeeLanguage}
              onChange={setEmployeeLanguage}
              className="w-full"
            />
            <p className="text-xs text-slate-500">
              You will see messages translated to this language
            </p>
          </div>

          {/* Customer Language Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <label className="text-sm font-medium text-white">
                Customer Language
              </label>
            </div>
            <LanguageSelector
              value={customerLanguage}
              onChange={setCustomerLanguage}
              className="w-full"
            />
            <p className="text-xs text-slate-500">
              Customer will see messages translated to this language
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Globe className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-slate-300">
                <p className="font-medium text-white mb-1">How it works:</p>
                <ul className="space-y-1 text-slate-400">
                  <li>• You'll see a split-screen view with both sides</li>
                  <li>• Left (blue): Your view in your language</li>
                  <li>• Right (green): Customer view in their language</li>
                  <li>• Messages translate automatically in real-time</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Start Button */}
          <Button
            onClick={handleStartDemo}
            disabled={starting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
          >
            {starting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Starting Demo...
              </>
            ) : (
              <>
                <MessageSquare className="w-5 h-5 mr-2" />
                Start Demo Chat
              </>
            )}
          </Button>

          {/* User Info */}
          {user && (
            <div className="text-center text-sm text-slate-500">
              Logged in as: <span className="text-slate-400">{user.email}</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function DemoStartPage() {
  return (
    <ProtectedRoute>
      <DemoStartContent />
    </ProtectedRoute>
  );
}
