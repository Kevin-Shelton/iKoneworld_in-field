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
  const [lastSpeaker, setLastSpeaker] = useState<"user" | "guest" | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "prompt">("prompt");
  
  const userRecognitionRef = useRef<any>(null);
  const guestRecognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastProcessedTextRef = useRef<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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

    // Fetch user's database ID first
    fetchUserDatabaseId().then((userId) => {
      if (userId) {
        setDbUserId(userId);
        // Initialize conversation in database
        initializeConversation(storedUserLang, storedGuestLang, userId);
      }
    });

    // Initialize Web Speech API for both languages
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      
      // User/Employee language recognition
      userRecognitionRef.current = new SpeechRecognition();
      userRecognitionRef.current.continuous = true;
      userRecognitionRef.current.interimResults = false;
      userRecognitionRef.current.lang = storedUserLang;
      userRecognitionRef.current.maxAlternatives = 1;

      userRecognitionRef.current.onresult = async (event: any) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.trim();
        const confidence = event.results[lastIndex][0].confidence;
        
        console.log(`[Employee ${storedUserLang}] "${transcript}" (conf: ${confidence})`);
        
        // Avoid duplicate processing
        if (transcript === lastProcessedTextRef.current) {
          console.log("[Employee] Skipping duplicate");
          return;
        }
        
        if (transcript.length > 2 && confidence > 0.4 && !isProcessingRef.current) {
          lastProcessedTextRef.current = transcript;
          await handleSpeechDetected(transcript, "user", storedUserLang, storedGuestLang);
        }
      };

      userRecognitionRef.current.onerror = (event: any) => {
        if (event.error !== "no-speech" && event.error !== "aborted") {
          console.error(`[Employee] Error: ${event.error}`);
          if (event.error === "not-allowed") {
            setMicPermission("denied");
            setError("Microphone access denied. Please allow microphone access in your browser settings.");
          }
        }
      };

      userRecognitionRef.current.onend = () => {
        if (isListening && !isProcessingRef.current) {
          setTimeout(() => {
            try {
              userRecognitionRef.current?.start();
            } catch (e) {
              // Already started
            }
          }, 100);
        }
      };

      // Guest/Customer language recognition
      guestRecognitionRef.current = new SpeechRecognition();
      guestRecognitionRef.current.continuous = true;
      guestRecognitionRef.current.interimResults = false;
      guestRecognitionRef.current.lang = storedGuestLang;
      guestRecognitionRef.current.maxAlternatives = 1;

      guestRecognitionRef.current.onresult = async (event: any) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.trim();
        const confidence = event.results[lastIndex][0].confidence;
        
        console.log(`[Customer ${storedGuestLang}] "${transcript}" (conf: ${confidence})`);
        
        // Avoid duplicate processing
        if (transcript === lastProcessedTextRef.current) {
          console.log("[Customer] Skipping duplicate");
          return;
        }
        
        if (transcript.length > 2 && confidence > 0.4 && !isProcessingRef.current) {
          lastProcessedTextRef.current = transcript;
          await handleSpeechDetected(transcript, "guest", storedGuestLang, storedUserLang);
        }
      };

      guestRecognitionRef.current.onerror = (event: any) => {
        if (event.error !== "no-speech" && event.error !== "aborted") {
          console.error(`[Customer] Error: ${event.error}`);
          if (event.error === "not-allowed") {
            setMicPermission("denied");
            setError("Microphone access denied. Please allow microphone access in your browser settings.");
          }
        }
      };

      guestRecognitionRef.current.onend = () => {
        if (isListening && !isProcessingRef.current) {
          setTimeout(() => {
            try {
              guestRecognitionRef.current?.start();
            } catch (e) {
              // Already started
            }
          }, 100);
        }
      };
    } else {
      setError("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
    }

    synthRef.current = window.speechSynthesis;

    return () => {
      if (userRecognitionRef.current) {
        try {
          userRecognitionRef.current.stop();
        } catch (e) {}
      }
      if (guestRecognitionRef.current) {
        try {
          guestRecognitionRef.current.stop();
        } catch (e) {}
      }
      stopAudioMonitoring();
    };
  }, [router]);

  const startAudioMonitoring = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicPermission("granted");

      // Create audio context and analyser
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Start monitoring audio levels
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const updateLevel = () => {
        if (!analyserRef.current || !isListening) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const normalizedLevel = Math.min(100, (average / 128) * 100);
        
        setAudioLevel(normalizedLevel);
        
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
      
      console.log("[Audio Monitor] Started");
    } catch (err) {
      console.error("[Audio Monitor] Error:", err);
      setMicPermission("denied");
      setError("Failed to access microphone. Please check your browser permissions.");
    }
  };

  const stopAudioMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    setAudioLevel(0);
    
    console.log("[Audio Monitor] Stopped");
  };

  const handleSpeechDetected = async (
    transcript: string,
    speaker: "user" | "guest",
    sourceLang: string,
    targetLang: string
  ) => {
    // Prevent concurrent processing
    if (isProcessingRef.current) {
      console.log("[Processing] Already processing, skipping");
      return;
    }
    
    isProcessingRef.current = true;
    setStatus("processing");
    setLastSpeaker(speaker);

    // Temporarily stop both recognitions while processing
    try {
      userRecognitionRef.current?.stop();
      guestRecognitionRef.current?.stop();
    } catch (e) {}

    try {
      console.log(`[Translation] ${speaker}: "${transcript}" (${sourceLang} → ${targetLang})`);
      
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
      const translatedText = translateData.translations?.[0]?.[0]?.text || "";

      console.log(`[Translation] Result: "${translatedText}"`);

      // Add message to UI
      const newMessage: Message = {
        id: Date.now().toString(),
        text: transcript,
        translatedText,
        speaker: speaker,
        timestamp: new Date(),
      };
      
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

      // Speak the translation
      setStatus("speaking");
      await speakText(translatedText, targetLang);
      
      // Clear the last processed text after a delay
      setTimeout(() => {
        lastProcessedTextRef.current = "";
      }, 3000);
      
    } catch (err) {
      console.error("[Translation] Error:", err);
      setError("Translation failed. Please try again.");
    } finally {
      isProcessingRef.current = false;
      setStatus("listening");
      
      // Restart both recognitions
      if (isListening) {
        setTimeout(() => {
          try {
            userRecognitionRef.current?.start();
          } catch (e) {}
          try {
            guestRecognitionRef.current?.start();
          } catch (e) {}
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

  const startAutoListening = async () => {
    if (!isListening) {
      setIsListening(true);
      setStatus("listening");
      setError("");
      lastProcessedTextRef.current = "";
      
      // Start audio monitoring
      await startAudioMonitoring();
      
      console.log(`[Start] Listening for ${userLang} (Employee) and ${guestLang} (Customer)`);
      
      try {
        userRecognitionRef.current?.start();
      } catch (e) {
        console.error("[Start] Employee recognition error:", e);
      }
      
      try {
        guestRecognitionRef.current?.start();
      } catch (e) {
        console.error("[Start] Customer recognition error:", e);
      }
    }
  };

  const stopAutoListening = () => {
    setIsListening(false);
    setStatus("ready");
    
    try {
      userRecognitionRef.current?.stop();
    } catch (e) {}
    
    try {
      guestRecognitionRef.current?.stop();
    } catch (e) {}
    
    stopAudioMonitoring();
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
    switch (status) {
      case "listening":
        return lastSpeaker 
          ? `Listening... (Last: ${lastSpeaker === "user" ? "Employee" : "Customer"})`
          : "Listening for both languages...";
      case "processing":
        return "Processing translation...";
      case "speaking":
        return "Playing translation...";
      default:
        return "Ready to start";
    }
  };

  const getMicLevelColor = () => {
    if (audioLevel < 10) return "bg-gray-400";
    if (audioLevel < 30) return "bg-green-400";
    if (audioLevel < 60) return "bg-yellow-400";
    return "bg-red-400";
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
                Automatic language detection - just speak naturally!
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
                    Start Listening
                  </button>
                ) : (
                  <button
                    onClick={stopAutoListening}
                    className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-lg"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                    </svg>
                    Stop Listening
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
            
            {/* Microphone Level Indicator */}
            {isListening && (
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Microphone Input Level: {Math.round(audioLevel)}%
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${micPermission === "granted" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {micPermission === "granted" ? "✓ Mic Active" : "✗ Mic Blocked"}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-100 ${getMicLevelColor()}`}
                    style={{ width: `${audioLevel}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {audioLevel < 5 
                    ? "⚠️ No audio detected - please check your microphone" 
                    : audioLevel < 20 
                    ? "🔉 Low audio - speak louder or move closer to mic"
                    : "✓ Good audio level"}
                </p>
              </div>
            )}
            
            {isListening && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  🎤 <strong>Auto-detection active:</strong> The system is listening for both <strong>{userLang}</strong> (Employee) and <strong>{guestLang}</strong> (Customer). 
                  Just speak naturally - the system will automatically detect which language is being spoken and translate accordingly.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Employee Messages */}
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

          {/* Customer Messages */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Customer Messages ({guestLang})
            </h2>
            <div className="space-y-auto max-h-96 overflow-y-auto">
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
