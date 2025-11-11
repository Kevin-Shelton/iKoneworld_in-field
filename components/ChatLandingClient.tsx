"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Loader2, Copy, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSelector } from "@/components/LanguageSelector";

interface ChatLandingClientProps {
  userId: string | null;
}

export default function ChatLandingClient({ userId }: ChatLandingClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [employeeLanguage, setEmployeeLanguage] = useState("en");
  const [customerLanguage, setCustomerLanguage] = useState("es");
  const [customerUrl, setCustomerUrl] = useState("");

  const handleStartChat = async () => {
    if (!userId) {
      toast.error("You must be logged in to start a chat.");
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      // Create a new conversation
      const response = await fetch("/api/chat/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language1: employeeLanguage,
          language2: customerLanguage,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const id = data.conversationId;
        setConversationId(id);
        
        // Construct the customer URL
        const url = `${window.location.origin}/chat/${id}/customer`;
        setCustomerUrl(url);
        
        // Redirect the employee to the conversation page
        router.push(`/chat/${id}`);
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
            Start a real-time translation conversation with a customer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {/* Language Selectors */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee-lang">Your Language</Label>
                <LanguageSelector
                  id="employee-lang"
                  value={employeeLanguage}
                  onChange={setEmployeeLanguage}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-lang">Customer Language</Label>
                <LanguageSelector
                  id="customer-lang"
                  value={customerLanguage}
                  onChange={setCustomerLanguage}
                />
              </div>
            </div>
            
            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-blue-900">How it works:</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Click "Start Chat" to generate a unique customer link and QR code.</li>
                <li>Share the link or QR code with your customer.</li>
                <li>The customer joins the chat in their selected language.</li>
                <li>You will be redirected to the employee chat view.</li>
              </ul>
            </div>
          </div>

          <Button
            onClick={handleStartChat}
            disabled={loading || !userId}
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
          
          {/* QR Code and URL Display */}
          {conversationId && customerUrl && (
            <div className="mt-6 border-t pt-6 space-y-4">
              <h3 className="text-xl font-bold text-gray-900 text-center">Share with Customer</h3>
              
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg shadow-lg">
                  <QRCodeSVG value={customerUrl} size={180} level="H" />
                </div>
              </div>
              
              {/* Customer URL */}
              <div className="space-y-2">
                <Label htmlFor="customer-url" className="text-base">Customer Link</Label>
                <div className="flex space-x-2">
                  <Input
                    id="customer-url"
                    type="text"
                    value={customerUrl}
                    readOnly
                    className="flex-1 bg-gray-100"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(customerUrl);
                      toast.success("Customer link copied!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-500 flex items-center">
                  <LinkIcon className="h-4 w-4 mr-1" />
                  Conversation ID: {conversationId}
                </p>
              </div>
            </div>
          )}

          <p className="text-center text-sm text-gray-500">
            By starting a chat, you agree to our terms of service
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
