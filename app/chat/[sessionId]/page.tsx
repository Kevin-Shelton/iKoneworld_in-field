"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LanguageSelector } from "@/components/LanguageSelector";
import { toast } from "sonner";
import { Send } from "lucide-react";

type Message = {
  id: number;
  conversationId: number;
  speaker: "user" | "guest";
  originalText: string;
  translatedText: string;
  language: string;
  timestamp: string;
};

export default function CustomerChatPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = parseInt(params.sessionId as string, 10);

  const [customerName, setCustomerName] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [customerLanguage, setCustomerLanguage] = useState("es");
  const [employeeLanguage, setEmployeeLanguage] = useState("en");
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const handleJoin = () => {
    if (!customerName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setHasJoined(true);
  };

  // Fetch conversation data
  useEffect(() => {
    if (!hasJoined) return;

    async function fetchConversation() {
      try {
        const response = await fetch(\`/api/demo/join/\${conversationId}\`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error("Error fetching conversation:", error);
      }
    }

    fetchConversation();

    // Poll for new messages every 2 seconds
    const interval = setInterval(fetchConversation, 2000);
    return () => clearInterval(interval);
  }, [conversationId, hasJoined]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim()) return;

    try {
      const response = await fetch("/api/demo/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          content: message,
          senderName: customerName,
          senderRole: "customer",
          sourceLang: customerLanguage,
          targetLang: employeeLanguage,
        }),
      });

      if (response.ok) {
        setMessage("");
      } else {
        toast.error("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  // Join screen
  if (!hasJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Join Chat Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Your Name</label>
              <Input
                placeholder="Enter your name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Your Language</label>
              <LanguageSelector
                value={customerLanguage}
                onChange={setCustomerLanguage}
                placeholder="Select your language"
              />
            </div>
            <Button onClick={handleJoin} className="w-full" size="lg">
              Join Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="p-4 bg-white border-b shadow-sm space-y-2">
        <div>
          <h1 className="text-xl font-bold text-center">Chat Support</h1>
          <p className="text-sm text-center text-gray-600">Welcome, {customerName}!</p>
        </div>
        <div className="flex justify-center">
          <LanguageSelector
            value={customerLanguage}
            onChange={setCustomerLanguage}
            label="Language:"
          />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={\`flex \${msg.speaker === "guest" ? "justify-end" : "justify-start"}\`}
            >
              <div
                className={\`max-w-[70%] rounded-lg p-3 \${
                  msg.speaker === "guest"
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-900 shadow"
                }\`}
              >
                <p className="font-medium">
                  {msg.speaker === "guest" ? msg.originalText : msg.translatedText}
                </p>
                <p className="text-xs mt-1 opacity-75">
                  {msg.speaker === "guest" ? msg.translatedText : msg.originalText}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 bg-white border-t">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <Button onClick={handleSend}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
