"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// ScrollArea component not available, using div with overflow
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

function DemoChatContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const conversationId = parseInt(params.sessionId as string, 10);

  const [messages, setMessages] = useState<Message[]>([]);
  const [employeeMessage, setEmployeeMessage] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [employeeLanguage, setEmployeeLanguage] = useState("en");
  const [customerLanguage, setCustomerLanguage] = useState("es");
  const [loading, setLoading] = useState(true);

  const employeeScrollRef = useRef<HTMLDivElement>(null);
  const customerScrollRef = useRef<HTMLDivElement>(null);

  // Fetch conversation data
  useEffect(() => {
    async function fetchConversation() {
      try {
        const response = await fetch(`/api/demo/join/${conversationId}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
        } else {
          toast.error("Failed to load conversation");
          router.push("/dashboard");
        }
      } catch (error) {
        console.error("Error fetching conversation:", error);
        toast.error("Failed to load conversation");
      } finally {
        setLoading(false);
      }
    }

    fetchConversation();

    // Poll for new messages every 2 seconds
    const interval = setInterval(fetchConversation, 2000);
    return () => clearInterval(interval);
  }, [conversationId, router]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (employeeScrollRef.current) {
      employeeScrollRef.current.scrollTop = employeeScrollRef.current.scrollHeight;
    }
    if (customerScrollRef.current) {
      customerScrollRef.current.scrollTop = customerScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleEmployeeSend = async () => {
    if (!employeeMessage.trim()) return;

    try {
      const response = await fetch("/api/demo/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          content: employeeMessage,
          senderName: user?.email || "Employee",
          senderRole: "employee",
          sourceLang: employeeLanguage,
          targetLang: customerLanguage,
        }),
      });

      if (response.ok) {
        setEmployeeMessage("");
      } else {
        toast.error("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleCustomerSend = async () => {
    if (!customerMessage.trim()) return;

    try {
      const response = await fetch("/api/demo/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          content: customerMessage,
          senderName: "Customer",
          senderRole: "customer",
          sourceLang: customerLanguage,
          targetLang: employeeLanguage,
        }),
      });

      if (response.ok) {
        setCustomerMessage("");
      } else {
        toast.error("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p>Loading conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Employee Side */}
      <div className="flex-1 flex flex-col border-r bg-white">
        <div className="p-4 border-b bg-blue-600 text-white space-y-2">
          <div>
            <h2 className="text-lg font-semibold">Employee View</h2>
            <p className="text-sm opacity-90">Session ID: {conversationId}</p>
          </div>
          <LanguageSelector
            value={employeeLanguage}
            onChange={setEmployeeLanguage}
            label="My Language:"
            className="text-white"
          />
        </div>

        <div className="flex-1 p-4 overflow-y-auto" ref={employeeScrollRef}>
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.speaker === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    msg.speaker === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-900"
                  }`}
                >
                  <p className="font-medium">
                    {msg.speaker === "user" ? msg.originalText : msg.translatedText}
                  </p>
                  <p className="text-xs mt-1 opacity-75">
                    {msg.speaker === "user" ? msg.translatedText : msg.originalText}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t bg-white">
          <div className="flex gap-2">
            <Input
              placeholder="Type your message..."
              value={employeeMessage}
              onChange={(e) => setEmployeeMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEmployeeSend()}
            />
            <Button onClick={handleEmployeeSend}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Customer Side */
      <div className="flex-1 flex flex-col bg-white">
        <div className="p-4 border-b bg-green-600 text-white space-y-2">
          <div>
            <h2 className="text-lg font-semibold">Customer View</h2>
            <p className="text-sm opacity-90">Real-time translation with Verbum AI</p>
          </div>
          <LanguageSelector
            value={customerLanguage}
            onChange={setCustomerLanguage}
            label="Customer Language:"
            className="text-white"
          />
        </div>

        <div className="flex-1 p-4 overflow-y-auto" ref={customerScrollRef}>
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.speaker === "guest" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    msg.speaker === "guest"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-900"
                  }`}
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
        </div>

        <div className="p-4 border-t bg-white">
          <div className="flex gap-2">
            <Input
              placeholder="Type customer message..."
              value={customerMessage}
              onChange={(e) => setCustomerMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCustomerSend()}
            />
            <Button onClick={handleCustomerSend} className="bg-green-600 hover:bg-green-700">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DemoChatPage() {
  return (
    <ProtectedRoute>
      <DemoChatContent />
    </ProtectedRoute>
  );
}
