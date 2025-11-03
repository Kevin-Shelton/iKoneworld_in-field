"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/lib/supabase/client";

type Message = {
  id: string;
  text: string;
  translatedText: string;
  speaker: "user" | "guest";
  timestamp: Date;
};

type Status = "ready" | "listening" | "processing" | "speaking";

// Default enterprise ID for development
const DEFAULT_ENTERPRISE_ID = "00000000-0000-0000-0000-000000000001";

function TranslatePageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [userLang, setUserLang] = useState<string>("");
  const [guestLang, setGuestLang] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>("ready");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string>("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerCode, setCustomerCode] = useState<string>("");
  const [dbUserId, setDbUserId] = useState<number | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<string>("");
  const [expectedSpeaker, setExpectedSpeaker] = useState<"user" | "guest">("user");
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const isProcessingRef = useRef<boolean>(false);

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
    setCurrentLanguage(storedUserLang); // Start with user language

    // Fetch user's database ID first
    fetchUserDatabaseId().then((userId) => {
      if (userId) {
        setDbUserId(userId);
        // Initialize conversation in database
        initializeConversation(storedUserLang, storedGuestLang, userId);
      }
    });

    // Initialize Web Speech API
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onstart = () => {
        console.log(`[Recognition] Started listening in: ${recognitionRef.current.lang}`);
      };

      recognitionRef.current.onresult = async (event: any) => {
        if (isProcessingRef.current) return;
        
        const lastResultIndex = event.results.length - 1;
        const result = event.results[lastResultIndex][0];
        const transcript = result.transcript.trim();
        const confidence = result.confidence;
        
        // Determine which language was actually spoken based on current recognition language
        const detectedLang = recognitionRef.current.lang;
        const isUserLanguage = detectedLang === storedUserLang;
        const speaker: "user" | "guest" = isUserLanguage ? "user" : "guest";
        
        console.log(`[Recognition] Detected in ${detectedLang}: "${transcript}" (confidence: ${confidence}, speaker: ${speaker})`);
        
        // Only process if we have actual content and reasonable confidence
        if (transcript.length > 0 && confidence > 0.3) {
          const sourceLang = isUserLanguage ? storedUserLang : storedGuestLang;
          const targetLang = isUserLanguage ? storedGuestLang : storedUserLang;
          
          await handleSpeechDetected(transcript, speaker, sourceLang, targetLang);
          
          // Switch to the other language for next turn
          const nextLang = isUserLanguage ? storedGuestLang : storedUserLang;
          setCurrentLanguage(nextLang);
          setExpectedSpeaker(isUserLanguage ? "guest" : "user");
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("[Recognition] Error:", event.error);
        
        if (event.error === "no-speech") {
          // No speech detected, just continue listening
          return;
        }
        
        if (event.error === "aborted") {
          // Recognition was aborted, restart if still listening
          if (isListening && !isProcessingRef.current) {
            setTimeout(() => {
              try {
                recognitionRef.current?.start();
              } catch (e) {
                console.log("[Recognition] Already started");
              }
            }, 100);
          }
          return;
        }
        
        // For other errors, show to user
        setError(`Recognition error: ${event.error}`);
      };

      recognitionRef.current.onend = () => {
        console.log("[Recognition] Ended");
        // Automatically restart if still in listening mode
        if (isListening && !isProcessingRef.current) {
          setTimeout(() => {
            try {
              recognitionRef.current?.start();
            } catch (e) {
              console.log("[Recognition] Already started");
            }
          }, 100);
        }
      };
    } else {
      setError("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
    }

    synthRef.current = window.speechSynthesis;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log("[Cleanup] Recognition already stopped");
        }
      }
    };
  }, [router, isListening]);

  // Update recognition language when currentLanguage changes
  useEffect(() => {
    if (recognitionRef.current && currentLanguage) {
      recognitionRef.current.lang = currentLanguage;
      console.log(`[Recognition] Language switched to: ${currentLanguage}`);
    }
  }, [currentLanguage]);

  const handleSpeechDetected = async (
    transcript: string,
    speaker: "user" | "guest",
    sourceLang: string,
    targetLang: string
  ) => {
    // Prevent concurrent processing
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    // Stop recognition while processing
    try {
      recognitionRef.current?.stop();
    } catch (e) {
      console.log("[Processing] Recognition already stopped");
    }

    setStatus("processing");

    try {
      console.log(`[Translation] Translating from ${sourceLang} to ${targetLang}: "${transcript}"`);
      
      // Translate the text using the API
      const translateResponse = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: [{ text: transcript }],
          from: sourceLang,
          to: [targetLang],
        }),
      });

      if (!translateResponse.ok) {
        throw new Error("Translation failed");
      }

      const translateData = await translateResponse.json();
      console.log('[Translation] Response:', translateData);
      const translatedText = translateData.translations?.[0]?.[0]?.text || "";

      // Add message to UI
      const newMessage: Message = {
        id: Date.now().toString(),
        text: transcript,
        translatedText,
        speaker: speaker,
        timestamp: new Date(),
      };
      
      console.log(`[Message] Adding to ${speaker} panel:`, newMessage);
      setMessages((prev) => [...prev, newMessage]);

      // Save message to database
      if (conversationId && dbUserId) {
        saveMessageToDatabase(
          conversationId,
          dbUserId,
          transcript,
          translatedText,
          sourceLang,
          targetLang,
          speaker
        );
      }

      // Speak the translation using Web Speech API
      setStatus("speaking");
      await speakText(translatedText, targetLang);
      setStatus("listening");
    } catch (err) {
      console.error("Translation error:", err);
      setError("Translation failed. Please try again.");
      setStatus("listening");
    } finally {
      isProcessingRef.current = false;
      
      // Restart recognition if still listening
      if (isListening) {
        setTimeout(() => {
          try {
            recognitionRef.current?.start();
          } catch (e) {
            console.log("[Processing] Recognition already started");
          }
        }, 500);
      }
    }
  };

  const fetchUserDatabaseId = async (): Promise<number | null> => {
    try {
      if (!user?.id) return null;
      
      const syncResponse = await fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email?.split('@')[0],
        }),
      });
      
      if (!syncResponse.ok) {
        console.error('Error syncing user to database');
        return null;
      }
      
      const syncData = await syncResponse.json();
      return syncData.userId;
    } catch (err) {
      console.error('Error in fetchUserDatabaseId:', err);
      return null;
    }
  };

  const initializeConversation = async (userLanguage: string, guestLanguage: string, userId: number) => {
    try {
      const customerResponse = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          enterpriseId: DEFAULT_ENTERPRISE_ID,
          preferredLanguage: guestLanguage,
        }),
      });

      if (!customerResponse.ok) {
        throw new Error("Failed to create customer");
      }

      const customerData = await customerResponse.json();
      setCustomerId(customerData.customer.id);
      setCustomerCode(customerData.customer.customer_code);

      const conversationResponse = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          userId: userId,
          enterpriseId: DEFAULT_ENTERPRISE_ID,
          storeId: undefined,
          departmentId: undefined,
          userLanguage,
          guestLanguage,
        }),
      });

      if (!conversationResponse.ok) {
        throw new Error("Failed to create conversation");
      }

      const conversationData = await conversationResponse.json();
      setConversationId(conversationData.conversation.id);
    } catch (err) {
      console.error("Error initializing conversation:", err);
    }
  };

  const saveMessageToDatabase = async (
    convId: number,
    userId: number,
    originalText: string,
    translatedText: string,
    sourceLang: string,
    targetLang: string,
    speaker: "user" | "guest"
  ) => {
    try {
      await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveMessage",
          conversationId: convId,
          enterpriseId: DEFAULT_ENTERPRISE_ID,
          userId: userId,
          speaker: speaker,
          originalText,
          translatedText,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
        }),
      });
    } catch (err) {
      console.error("Error saving message:", err);
    }
  };

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

  const startAutoListening = () => {
    if (!isListening && recognitionRef.current) {
      setIsListening(true);
      setStatus("listening");
      setError("");
      
      // Start with user language
      recognitionRef.current.lang = userLang;
      setCurrentLanguage(userLang);
      setExpectedSpeaker("user");
      
      try {
        recognitionRef.current.start();
        console.log(`[Start] Listening for ${userLang} first`);
      } catch (e) {
        console.error("[Start] Error starting recognition:", e);
      }
    }
  };

  const stopAutoListening = () => {
    setIsListening(false);
    setStatus("ready");
    
    try {
      recognitionRef.current?.stop();
    } catch (e) {
      console.log("[Stop] Recognition already stopped");
    }
  };

  const endConversation = async () => {
    stopAutoListening();

    if (conversationId) {
      try {
        await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "end",
            conversationId,
          }),
        });
      } catch (err) {
        console.error("Error ending conversation:", err);
      }
    }

    router.push("/dashboard");
  };

  const getStatusColor = () => {
    switch (status) {
      case "listening":
        return "bg-green-500 animate-pulse";
      case "processing":
        return "bg-yellow-500";
      case "speaking":
        return "bg-blue-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = () => {
    const langName = currentLanguage === userLang ? "Employee" : "Customer";
    
    switch (status) {
      case "listening":
        return `Listening for ${langName} (${currentLanguage})...`;
      case "processing":
        return "Processing translation...";
      case "speaking":
        return "Playing translation...";
      default:
        return "Ready to start";
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
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                Real-Time Translation
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Automatic turn-based conversation - speak naturally and wait for translation!
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  Employee: {userLang}
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  Customer: {guestLang}
                </span>
              </div>
            </div>
            {customerCode && (
              <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow">
                <p className="text-xs text-gray-500 dark:text-gray-400">Customer ID</p>
                <p className="text-sm font-mono font-semibold text-gray-900 dark:text-white">
                  {customerCode}
                </p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Status and Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col gap-4">
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
                    onClick={startAutoListening}
                    className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-lg"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    Start Conversation
                  </button>
                ) : (
                  <button
                    onClick={stopAutoListening}
                    className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-lg"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                    </svg>
                    Pause
                  </button>
                )}
                <button
                  onClick={endConversation}
                  className="px-6 py-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  End Conversation
                </button>
              </div>
            </div>
            
            {isListening && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  🎤 <strong>Turn-based conversation:</strong> The system alternates between listening for 
                  <strong> {userLang}</strong> (Employee) and <strong>{guestLang}</strong> (Customer). 
                  Speak when it's your turn, then wait for the translation before the other person speaks.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Employee Messages (User) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Employee Messages ({userLang})
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {messages.filter(m => m.speaker === "user").length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No messages yet</p>
              ) : (
                messages
                  .filter(m => m.speaker === "user")
                  .map((message) => (
                    <div key={message.id} className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                      <p className="text-gray-900 dark:text-white font-medium">{message.text}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">
                        → {message.translatedText}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Customer Messages (Guest) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Customer Messages ({guestLang})
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {messages.filter(m => m.speaker === "guest").length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No messages yet</p>
              ) : (
                messages
                  .filter(m => m.speaker === "guest")
                  .map((message) => (
                    <div key={message.id} className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                      <p className="text-gray-900 dark:text-white font-medium">{message.text}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">
                        → {message.translatedText}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TranslatePage() {
  return (
    <ProtectedRoute>
      <TranslatePageContent />
    </ProtectedRoute>
  );
}
