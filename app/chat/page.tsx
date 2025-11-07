"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ChatLandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleStartChat = async () => {
    setLoading(true);
    try {
      // Create a new conversation
      const response = await fetch("/api/chat/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language1: "en",
          language2: "es",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Redirect to the conversation page
        router.push(`/chat/${data.conversationId}`);
      } else {
        toast.error("Failed to start chat. Please try again.");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error starting chat:", error);
      toast.error("Failed to start chat. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900">
            Welcome to iKoneworld Chat
          </CardTitle>
          <CardDescription className="text-lg text-gray-600">
            Start a real-time translation conversation with our team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-blue-900">How it works:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Click "Start Chat" to begin</li>
              <li>Speak in your language</li>
              <li>Get instant translation</li>
              <li>Communicate effortlessly</li>
            </ul>
          </div>

          <Button
            onClick={handleStartChat}
            disabled={loading}
            className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Starting Chat...
              </>
            ) : (
              <>
                <MessageSquare className="mr-2 h-5 w-5" />
                Start Chat
              </>
            )}
          </Button>

          <p className="text-center text-sm text-gray-500">
            By starting a chat, you agree to our terms of service
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Prevent static generation for this page
export const dynamic = 'force-dynamic';
