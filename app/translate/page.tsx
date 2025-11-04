"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { io, Socket } from "socket.io-client";

type Message = {
  id: string;
  text: string;
  translatedText: string;
  speaker: "user" | "guest";
  timestamp: Date;
  confidence?: number;
};

type Status = "ready" | "listening" | "processing" | "speaking" | "reconnecting";

type PendingRecognition = {
  t: number;
  lang: string;
  conf: number;
  text: string;
  timeoutId?: NodeJS.Timeout;
};

// Default enterprise ID for development
const DEFAULT_ENTERPRISE_ID = "00000000-0000-0000-0000-000000000001";
const PAIR_WINDOW_MS = 1500;
const ORPHAN_TIMEOUT_MS = 2500;

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

  const [recognizingText, setRecognizingText] = useState<string>("");
  
  // Audio processing refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  
  // Socket.IO refs
  const socket1Ref = useRef<Socket | null>(null); // User/Employee language
  const socket2Ref = useRef<Socket | null>(null); // Guest/Customer language
  
  // Pending recognitions for winner selection
  const pendingRef = useRef<{ ws1: PendingRecognition[]; ws2: PendingRecognition[] }>({
    ws1: [],
    ws2: []
  });
  
  // Playback queue and mic hold
  const playbackQueueRef = useRef<Promise<void>>(Promise.resolve());
  const micHoldCountRef = useRef<number>(0);
  const stoppingRef = useRef<boolean>(false);
  const voicesRef = useRef<Record<string, { male: string[]; female: string[] }>>({});
  
  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentRecordingStartRef = useRef<number>(0);

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

    // Fetch user's database ID and initialize conversation
    fetchUserDatabaseId().then((userId) => {
      if (userId) {
        setDbUserId(userId);
        initializeConversation(storedUserLang, storedGuestLang, userId);
      }
    });

    // Fetch voices for TTS
    fetchVoices();

    return () => {
      cleanup();
    };
  }, [router]);

  const fetchVoices = async () => {
    try {
      const response = await fetch("/api/voices");
      if (response.ok) {
        const data = await response.json();
        voicesRef.current = data.voices || {};
      }
    } catch (err) {
      console.error("[Voices] Error fetching voices:", err);
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

  const uploadAudioRecording = async (
    audioBlob: Blob,
    conversationId: number,
    enterpriseId: string,
    speaker: 'user' | 'guest',
    timestamp: number
  ): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, `${speaker}_${timestamp}.webm`);
      formData.append('conversationId', conversationId.toString());
      formData.append('enterpriseId', enterpriseId);
      formData.append('speaker', speaker);
      formData.append('timestamp', timestamp.toString());

      const response = await fetch('/api/audio/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[AudioUpload] Failed:', response.status, errorData);
        return null;
      }

      const data = await response.json();
      console.log('[AudioUpload] Success:', data.audioUrl);
      return data.audioUrl;
    } catch (err) {
      console.error('[AudioUpload] Error:', err);
      return null;
    }
  };

  const saveMessageToDatabase = async (
    convId: number,
    userId: number,
    originalText: string,
    translatedText: string,
    sourceLang: string,
    targetLang: string,
    speaker: "user" | "guest",
    audioUrl?: string | null
  ) => {
    try {
      console.log('[SaveMessage] Attempting to save:', { convId, userId, speaker, originalText, translatedText, sourceLang, targetLang });
      const response = await fetch("/api/conversations", {
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
          audioUrl: audioUrl || null,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[SaveMessage] Failed:', response.status, errorData);
      } else {
        const data = await response.json();
        console.log('[SaveMessage] Success:', data);
      }
    } catch (err) {
      console.error("[SaveMessage] Error:", err);
    }
  };

  const baseLang = (code: string): string => {
    return (code || '').split('-')[0].toLowerCase();
  };

  const translateText = async (text: string, from: string, to: string): Promise<string> => {
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: [{ text }],
          from: baseLang(from),
          to: [baseLang(to)]
        })
      });

      if (!response.ok) {
        throw new Error(`Translation failed: ${response.status}`);
      }

      const data = await response.json();
      if (data?.translations && Array.isArray(data.translations) && data.translations[0][0]?.text) {
        return data.translations[0][0].text;
      }
      return text;
    } catch (err) {
      console.error('[Translation] Error:', err);
      return text + ' (translation failed)';
    }
  };

  const speakText = async (text: string, langCode: string): Promise<void> => {
    // Disable microphone during TTS playback
    if (streamRef.current) {
      micHoldCountRef.current++;
      streamRef.current.getTracks().forEach(track => track.enabled = false);
    }

    playbackQueueRef.current = playbackQueueRef.current.then(async () => {
      let audioUrl: string | null = null;
      try {
        // Get voice for language with fallback to base language
        let voices = voicesRef.current[langCode];
        
        // If dialect not found, try base language (e.g., es-AR → es-MX)
        if (!voices) {
          const baseCode = langCode.split('-')[0]; // e.g., "es" from "es-AR"
          const fallbackCodes = {
            'es': 'es-MX',
            'en': 'en-US',
            'fr': 'fr-FR',
            'pt': 'pt-BR',
            'zh': 'zh-CN',
            'ar': 'ar-SA'
          };
          const fallbackCode = fallbackCodes[baseCode as keyof typeof fallbackCodes];
          if (fallbackCode) {
            voices = voicesRef.current[fallbackCode];
            console.log(`[TTS] Using fallback ${fallbackCode} for ${langCode}`);
          }
        }
        
        const voice = voices?.male?.[0] || voices?.female?.[0];
        
        if (!voice) {
          console.warn(`[TTS] No voice found for ${langCode}`);
          return;
        }

        const response = await fetch('/api/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voice,
            text,
            audioFormat: 'Audio16Khz128KBitMp3',
            model: 'default'
          })
        });

        if (!response.ok) {
          throw new Error(`TTS failed: ${response.status}`);
        }

        const blob = await response.blob();
        audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);

        setStatus('speaking');

        const releaseMic = () => {
          if (streamRef.current) {
            micHoldCountRef.current = Math.max(0, micHoldCountRef.current - 1);
            if (micHoldCountRef.current === 0) {
              streamRef.current.getTracks().forEach(track => track.enabled = true);
            }
          }
        };

        const finalize = () => {
          setStatus('listening');
          if (audioUrl) URL.revokeObjectURL(audioUrl);
          releaseMic();
        };

        audio.onended = finalize;
        audio.onerror = finalize;

        await audio.play().catch(err => {
          console.warn('[TTS] Autoplay blocked:', err);
          finalize();
        });
      } catch (err) {
        console.error('[TTS] Error:', err);
        setStatus('listening');
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        if (streamRef.current) {
          micHoldCountRef.current = Math.max(0, micHoldCountRef.current - 1);
          if (micHoldCountRef.current === 0) {
            streamRef.current.getTracks().forEach(track => track.enabled = true);
          }
        }
      }
    });

    return playbackQueueRef.current;
  };

  const processWinner = async (winner: PendingRecognition) => {
    const lang1Base = baseLang(userLang);
    const lang2Base = baseLang(guestLang);
    const winBase = baseLang(winner.lang);

    console.log(`[Winner] Processing: "${winner.text}" (${winner.lang}, conf: ${winner.conf.toFixed(2)})`);

    if (winBase === lang1Base) {
      // User/Employee spoke
      const translated = await translateText(winner.text, userLang, guestLang);
      
      const newMessage: Message = {
        id: Date.now().toString(),
        text: winner.text,
        translatedText: translated,
        speaker: "user",
        timestamp: new Date(),
        confidence: winner.conf
      };
      
      setMessages(prev => [...prev, newMessage]);

      // Capture and upload audio recording
      let audioUrl: string | null = null;
      if (conversationId && audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioUrl = await uploadAudioRecording(
          audioBlob,
          conversationId,
          DEFAULT_ENTERPRISE_ID,
          'user',
          Date.now()
        );
        // Clear chunks for next recording
        audioChunksRef.current = [];
        currentRecordingStartRef.current = Date.now();
      }

      // Save to database with audio URL
      if (conversationId && dbUserId) {
        saveMessageToDatabase(
          conversationId,
          dbUserId,
          winner.text,
          translated,
          userLang,
          guestLang,
          "user",
          audioUrl
        );
      }

      // Speak translation in guest language
      await speakText(translated, guestLang);
    } else {
      // Guest/Customer spoke
      const translated = await translateText(winner.text, guestLang, userLang);
      
      const newMessage: Message = {
        id: Date.now().toString(),
        text: winner.text,
        translatedText: translated,
        speaker: "guest",
        timestamp: new Date(),
        confidence: winner.conf
      };
      
      setMessages(prev => [...prev, newMessage]);

      // Capture and upload audio recording
      let audioUrl: string | null = null;
      if (conversationId && audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioUrl = await uploadAudioRecording(
          audioBlob,
          conversationId,
          DEFAULT_ENTERPRISE_ID,
          'guest',
          Date.now()
        );
        // Clear chunks for next recording
        audioChunksRef.current = [];
        currentRecordingStartRef.current = Date.now();
      }

      // Save to database with audio URL
      if (conversationId && dbUserId) {
        saveMessageToDatabase(
          conversationId,
          dbUserId,
          winner.text,
          translated,
          guestLang,
          userLang,
          "guest",
          audioUrl
        );
      }
    }

    setRecognizingText("");
  };

  const handleRecognized = async (which: 'ws1' | 'ws2', lang: string, data: any) => {
    if (!data || !data.text) return;

    if (data.status === 'recognizing') {
      setRecognizingText(data.text);
      return;
    }

    if (data.status !== 'recognized') return;

    const conf = typeof data.confidence === 'number' ? data.confidence : 0;
    
    // Filter out low confidence results
    if (conf < 0.1) {
      console.log(`[${which}] Low confidence (${conf.toFixed(2)}), skipping: "${data.text}"`);
      return;
    }

    console.log(`[${which}] Recognized: "${data.text}" (conf: ${conf.toFixed(2)})`);

    const now = Date.now();
    const mine: PendingRecognition = { t: now, lang, conf, text: data.text };
    const mineBuf = pendingRef.current[which];
    const otherKey = which === 'ws1' ? 'ws2' : 'ws1';
    const otherBuf = pendingRef.current[otherKey];

    // Look for a mate in the other buffer within the time window
    let mateIdx = -1;
    for (let i = 0; i < otherBuf.length; i++) {
      if (Math.abs(mine.t - otherBuf[i].t) <= PAIR_WINDOW_MS) {
        mateIdx = i;
        break;
      }
    }

    if (mateIdx >= 0) {
      // Found a mate - pick the winner based on confidence
      const mate = otherBuf.splice(mateIdx, 1)[0];
      if (mate && mate.timeoutId) clearTimeout(mate.timeoutId);
      const winner = (mine.conf >= (mate.conf ?? 0)) ? mine : mate;
      await processWinner(winner);
    } else {
      // No mate found - set orphan timeout
      mine.timeoutId = setTimeout(async () => {
        const idx = mineBuf.indexOf(mine);
        if (idx !== -1) {
          mineBuf.splice(idx, 1);
          await processWinner(mine);
        }
      }, ORPHAN_TIMEOUT_MS);
      mineBuf.push(mine);
    }
  };

  const openSocket = (which: 'ws1' | 'ws2', lang: string, apiKey: string): Socket => {
    console.log(`[Socket ${which}] Opening for language: ${lang}`);
    
    const sock = io('wss://sdk.verbum.ai/listen', {
      path: '/v1/socket.io',
      transports: ['websocket'],
      auth: { token: apiKey },
      query: { language: [lang], encoding: 'PCM', profanityFilter: 'raw' },
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000
    });

    sock.on('connect', () => {
      console.log(`[Socket ${which}] Connected`);
      if (status === 'reconnecting') setStatus('listening');
    });

    sock.on('speechRecognized', (data) => {
      handleRecognized(which, lang, data);
    });

    sock.on('disconnect', (reason) => {
      console.log(`[Socket ${which}] Disconnected:`, reason);
      if (!stoppingRef.current) {
        setStatus('reconnecting');
      }
    });

    sock.io.on('reconnect_attempt', (attempt) => {
      console.log(`[Socket ${which}] Reconnecting attempt ${attempt}...`);
      if (!stoppingRef.current) {
        setStatus('reconnecting');
      }
    });

    sock.io.on('reconnect', () => {
      console.log(`[Socket ${which}] Reconnected`);
      if (!stoppingRef.current) {
        setStatus('listening');
      }
    });

    sock.on('error', (err) => {
      console.error(`[Socket ${which}] Error:`, err);
    });

    return sock;
  };

  const startListening = async () => {
    try {
      stoppingRef.current = false;
      setError("");
      setStatus("listening");
      setIsListening(true);

      // Get API key from server
      const keyResponse = await fetch('/api/token');
      if (!keyResponse.ok) {
        throw new Error('Failed to get API key');
      }
      const { apiKey } = await keyResponse.json();

      console.log('[Start] Opening sockets...');
      
      // Open Socket.IO connections
      socket1Ref.current = openSocket('ws1', userLang, apiKey);
      socket2Ref.current = openSocket('ws2', guestLang, apiKey);

      console.log('[Start] Requesting microphone access...');

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        },
        video: false
      });

      streamRef.current = stream;

      // Initialize MediaRecorder for audio recording
      try {
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        });
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(1000); // Collect data every second
        currentRecordingStartRef.current = Date.now();
        console.log('[Recording] MediaRecorder started');
      } catch (err) {
        console.error('[Recording] Failed to start MediaRecorder:', err);
      }

      console.log('[Start] Creating audio context...');

      // Create audio context
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;

      console.log(`[Start] Audio context created, sample rate: ${ctx.sampleRate}`);



      // Create audio worklet for downsampling to 8kHz PCM
      const workletCode = `
        class DownsampleWorklet extends AudioWorkletProcessor {
          constructor() {
            super();
            this.buf = [];
            this.inRate = sampleRate;
            this.outRate = 8000;
          }
          
          process(inputs) {
            if (inputs[0].length > 0) {
              const ch = inputs[0][0];
              const ratio = this.inRate / this.outRate;
              let off = 0;
              
              while (Math.floor(off) < ch.length) {
                this.buf.push(ch[Math.floor(off)]);
                off += ratio;
              }
              
              while (this.buf.length >= 160) {
                const slice = this.buf.splice(0, 160);
                const ab = new ArrayBuffer(slice.length * 2);
                const v = new DataView(ab);
                
                for (let i = 0; i < slice.length; i++) {
                  let s = Math.max(-1, Math.min(1, slice[i]));
                  v.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                }
                
                this.port.postMessage(ab);
              }
            }
            return true;
          }
        }
        registerProcessor('downsample-worklet', DownsampleWorklet);
      `;

      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);

      await ctx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      console.log('[Start] Audio worklet loaded');

      // Create nodes
      const source = ctx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(ctx, 'downsample-worklet');

      sourceNodeRef.current = source;
      workletNodeRef.current = worklet;

      // Send audio data to both sockets
      worklet.port.onmessage = (ev) => {
        if (socket1Ref.current?.connected) {
          socket1Ref.current.emit('audioStream', ev.data);
        }
        if (socket2Ref.current?.connected) {
          socket2Ref.current.emit('audioStream', ev.data);
        }
      };

      // Connect audio pipeline
      source.connect(worklet);
      worklet.connect(ctx.destination);

      console.log('[Start] Audio pipeline connected');



    } catch (err) {
      console.error('[Start] Error:', err);
      setError(`Failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsListening(false);
      setStatus('ready');
      cleanup();
    }
  };



  const stopListening = () => {
    stoppingRef.current = true;
    setIsListening(false);
    setStatus('ready');
    cleanup();
  };

  const cleanup = async () => {
    console.log('[Cleanup] Starting...');

    // End conversation if one is active
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
        console.log('[Cleanup] Conversation ended');
      } catch (err) {
        console.error("[Cleanup] Error ending conversation:", err);
      }
    }

    // Disconnect audio nodes
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    audioChunksRef.current = [];

    // Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Disconnect sockets
    if (socket1Ref.current?.connected) {
      socket1Ref.current.disconnect();
      socket1Ref.current = null;
    }

    if (socket2Ref.current?.connected) {
      socket2Ref.current.disconnect();
      socket2Ref.current = null;
    }

    // Clear pending recognitions
    ['ws1', 'ws2'].forEach((k) => {
      const key = k as 'ws1' | 'ws2';
      pendingRef.current[key].forEach(item => {
        if (item.timeoutId) clearTimeout(item.timeoutId);
      });
      pendingRef.current[key] = [];
    });

    setRecognizingText("");


    console.log('[Cleanup] Complete');
  };

  const endConversation = async () => {
    stopListening();

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
      case "reconnecting":
        return "bg-orange-500 animate-pulse";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "listening":
        return "Listening for both languages...";
      case "processing":
        return "Processing translation...";
      case "speaking":
        return "Playing translation...";
      case "reconnecting":
        return "Reconnecting...";
      default:
        return "Ready to start";
    }
  };



  if (!userLang || !guestLang) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      <Navigation />
      <div className="container mx-auto max-w-6xl py-8 px-4 flex-1">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                Real-Time Translation
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Automatic language detection
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
                    onClick={startListening}
                    className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-lg"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    Start Listening
                  </button>
                ) : (
                  <button
                    onClick={stopListening}
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
            


            {/* Recognizing indicator */}
            {recognizingText && (
              <div className="bg-gray-800 text-white rounded-lg p-3 text-sm">
                <span className="opacity-75">Listening… </span>{recognizingText}
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
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                        {message.confidence !== undefined && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                            {(message.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
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
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                        {message.confidence !== undefined && (
                          <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                            {(message.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
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
