"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { MessageSquare, Copy, ExternalLink } from "lucide-react";

interface StartDemoChatProps {
  userId: number;
}

export function StartDemoChat({ userId }: StartDemoChatProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [customerUrl, setCustomerUrl] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStartDemo = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/demo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          language1: "en",
          language2: "es",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setQrCode(data.qrCode);
        setCustomerUrl(data.customerUrl);
        setConversationId(data.conversationId);
        setShowModal(true);
      } else {
        toast.error("Failed to start demo chat");
      }
    } catch (error) {
      console.error("Error starting demo:", error);
      toast.error("Failed to start demo chat");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(customerUrl);
    toast.success("URL copied to clipboard");
  };

  const handleOpenDemo = () => {
    if (conversationId) {
      router.push(`/demo/${conversationId}`);
    }
  };

  return (
    <>
      <Button
        onClick={handleStartDemo}
        disabled={loading}
        className="w-full sm:w-auto"
        size="lg"
      >
        <MessageSquare className="mr-2 h-5 w-5" />
        {loading ? "Starting..." : "Start Demo Chat"}
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Demo Chat Session Started</DialogTitle>
            <DialogDescription>
              Share this QR code or URL with your customer to join the chat
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* QR Code */}
            <div className="flex justify-center p-4 bg-white rounded-lg border">
              {qrCode && (
                <img src={qrCode} alt="QR Code" className="w-48 h-48" />
              )}
            </div>

            {/* Customer URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customerUrl}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm border rounded-md bg-gray-50"
                />
                <Button
                  onClick={handleCopyUrl}
                  variant="outline"
                  size="sm"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleOpenDemo}
                className="flex-1"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Demo Interface
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
