"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  text: string;
  translatedText: string;
  speaker: "user" | "guest";
  timestamp: Date;
};

type Status = "ready" | "listening" | "processing" | "speaking";

export default function TranslatePage() {
  const router = useRouter();
  const [userLang, setUserLang] = useState<string>("");
  const [guestLang, setGuestLang] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>("ready");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string>("");
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    // Load selected languages from localStorage
    const storedUserLang = localStorage.getItem("userLanguage");
    const storedGuestLang = localStorage.getItem("guestLanguage");

    if (!storedUserLang || !storedGuestLang) {
      router.push("/select-language");
      return;
    }

    setUserLang(storedUserLang);
    setGuestLang(storedGuestLang);

    // Initialize Web Speech API
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = storedUserLang;

      recognitionRef.current.onstart = () => {
        setStatus("listening");
        setError("");
      };

      recognitionRef.current.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        setStatus("processing");

        try {
          // Translate the text using the API
          const translateResponse = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              texts: [{ text: transcript }],
              from: storedUserLang,
              to: [storedGuestLang],
            }),
          });

          if (!translateResponse.ok) {
            throw new Error("Translation failed");
          }

          const translateData = await translateResponse.json();
          const translatedText = translateData.translations?.[0]?.text || "";

          // Add message
          const newMessage: Message = {
            id: Date.now().toString(),
            text: transcript,
            translatedText,
            speaker: "user",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, newMessage]);

          // Speak the translation using Web Speech API
          setStatus("speaking");
          await speakText(translatedText, storedGuestLang);
          setStatus("ready");
        } catch (err) {
          console.error("Translation error:", err);
          setError("Translation failed. Please try again.");
          setStatus("ready");
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setError(`Speech recognition error: ${event.error}`);
        setStatus("ready");
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (status === "listening") {
          setStatus("ready");
        }
      };
    } else {
      setError("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
    }

    synthRef.current = window.speechSynthesis;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [router, status]);

  const speakText = (text: string, lang: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!synthRef.current) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      
      synthRef.current.speak(utterance);
    });
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      setError("");
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setStatus("ready");
    }
  };

  const endConversation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    router.push("/");
  };

  const getStatusColor = () => {
    switch (status) {
      case "listening":
        return "bg-red-500";
      case "processing":
        return "bg-yellow-500";
      case "speaking":
        return "bg-green-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "listening":
        return "Listening...";
      case "processing":
        return "Processing...";
      case "speaking":
        return "Speaking...";
      default:
        return "Ready";
    }
  };

  if (!userLang || !guestLang) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto max-w-6xl py-8 px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Real-Time Translation
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              Your Language: {userLang}
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              Guest Language: {guestLang}
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Status and Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${getStatusColor()}`}></div>
              <span className="text-lg font-medium text-gray-900 dark:text-white">
                {getStatusText()}
              </span>
            </div>
            <div className="flex gap-3">
              {!isListening ? (
                <button
                  onClick={startListening}
                  disabled={status !== "ready"}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  Start Speaking
                </button>
              ) : (
                <button
                  onClick={stopListening}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                  </svg>
                  Stop Speaking
                </button>
              )}
              <button
                onClick={endConversation}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                End Conversation
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Messages */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Your Messages ({userLang})
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {messages.filter((m) => m.speaker === "user").length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No messages yet. Start speaking!
                </p>
              ) : (
                messages
                  .filter((m) => m.speaker === "user")
                  .map((message) => (
                    <div
                      key={message.id}
                      className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4"
                    >
                      <p className="text-gray-900 dark:text-white font-medium">
                        {message.text}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Guest Messages (Translations) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Translations ({guestLang})
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Translations will appear here...
                </p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4"
                  >
                    <p className="text-gray-900 dark:text-white font-medium">
                      {message.translatedText}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>💡 Using browser's built-in speech recognition (Chrome/Edge recommended)</p>
        </div>
      </div>
    </div>
  );
}
