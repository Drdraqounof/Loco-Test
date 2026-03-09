"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Settings, Trash2, Mic, Send, X, Copy, Check, Undo2, Play, Pause, Volume2, History, Plus, MessageSquare } from "lucide-react";
import { useSpeechRecognition } from "@/tools/hooks/useSpeechRecognition";
import { useAudioPlayer } from "@/tools/hooks/useAudioPlayer";
import { useElectron } from "@/tools/hooks/useElectron";
import { parseResponse } from "@/tools/hooks/utils/messageParser";
import { VOICE_THEMES, VoiceKey } from "@/tools/hooks/utils/themes";
import { callAIAPI } from "@/tools/hooks/utils/apiClient";


// ── Types ──
interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface ChatSessionsResponse {
  sessions: ChatSession[];
}

interface ChatSessionResponse {
  session: ChatSession;
}

// ── Data ──
const ALL_PROMPTS = [
  { emoji: "📝", text: "Build a React Todo List component with add, delete, and localStorage persistence" },
  { emoji: "💡", text: "Explain React hooks (useState, useEffect, useRef) with practical examples" },
  { emoji: "🐛", text: "Help me debug: 'TypeError: undefined is not a function' in JavaScript" },
  { emoji: "🎨", text: "Create a responsive Navbar component using React and Tailwind CSS" },
  { emoji: "⚡", text: "Optimize this React component for performance (re-renders, memoization, keys)" },
  { emoji: "📚", text: "Explain the difference between var, let, and const with real examples" },
  { emoji: "🔧", text: "Set up a Next.js project with TypeScript and ESLint step-by-step" },
  { emoji: "🌐", text: "Build a React form with validation using React Hook Form or custom validation" },
  { emoji: "📊", text: "Create a data visualization dashboard using Chart.js in React" },
  { emoji: "🚀", text: "Deploy a Next.js app to Vercel with environment variables configured" },
];

const PARTICLES = Array.from({ length: 40 }, (_, i) => ({
  left: `${((i * 17 + 13) % 100)}%`,
  top: `${((i * 23 + 7) % 100)}%`,
  duration: ((i * 31 + 11) % 40) / 10 + 3,
  delay: ((i * 37 + 3) % 20) / 10,
  opacity: ((i * 41 + 5) % 60) / 100 + 0.2,
}));

const EYE_POSITIONS = [
  { x: -20, y: 0 }, { x: 0, y: 0 }, { x: 20, y: 0 },
  { x: 0, y: 0 }, { x: -20, y: 0 }, { x: 20, y: 0 },
  { x: 0, y: -12 }, { x: 0, y: 0 }, { x: -15, y: -8 },
  { x: 15, y: -8 }, { x: 0, y: 0 },
];

function getRandomPrompts(count: number) {
  return [...ALL_PROMPTS].sort(() => Math.random() - 0.5).slice(0, count);
}

// Helper to strip URLs from text for speech
const stripUrlsFromText = (text: string): string => {
  let cleaned = text;
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  cleaned = cleaned.replace(/<a\s+href="[^"]*"[^>]*>([^<]*)<\/a>/gi, "$1");
  cleaned = cleaned.replace(/https?:\/\/[^\s)]+/g, "");
  cleaned = cleaned.replace(/www\.[^\s)]+/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
};

// Helper for natural chunked speech synthesis
function speakChunks(text: string, voiceIndex: number) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  // Split into thought-based chunks for JARVIS-style delivery
  const chunks = text
    .split(/(?<=[.!?…])\s+|(?<=,)\s+(?=[A-Z])/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const voices = window.speechSynthesis.getVoices();
  // Prefer a deep, natural-sounding voice (JARVIS-style)
  const preferredVoice =
    voices.find(v => v.name.toLowerCase().includes("david")) ||
    voices.find(v => v.name.toLowerCase().includes("natural")) ||
    voices.find(v => v.name.toLowerCase().includes("google")) ||
    (voices.length > 0 ? voices[voiceIndex % voices.length] : null);

  function speakNext(remaining: string[]) {
    if (!remaining.length) return;
    const utterance = new SpeechSynthesisUtterance(remaining[0]);
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onend = () => speakNext(remaining.slice(1));
    window.speechSynthesis.speak(utterance);
  }

  speakNext(chunks);
}

// ── Main Component ──
export default function Home() {
  const router = useRouter();
  const { isElectron, clipboard } = useElectron();
  
  // Start screen state - always start false to avoid hydration mismatch
  const [showStartScreen, setShowStartScreen] = useState(false);
  const [startScreenChecked, setStartScreenChecked] = useState(false);
  const [phase, setPhase] = useState<"intro" | "eyes" | "fadeout">("intro");
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });

  // Chat & settings state
  const [voice, setVoice] = useState<VoiceKey>("echo");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [extractedCode, setExtractedCode] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const [terminalCommands, setTerminalCommands] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<Array<{ emoji: string; text: string }>>([]);
  const [lastAudioBase64, setLastAudioBase64] = useState<string | null>(null);
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [enablePingPong, setEnablePingPong] = useState(true);
  const [enableChess, setEnableChess] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const upsertSessionState = (session: ChatSession) => {
    setChatSessions((previousSessions) => {
      const withoutCurrent = previousSessions.filter((entry) => entry.id !== session.id);
      return [session, ...withoutCurrent].sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      );
    });
  };

  const syncTerminalFromMessages = (sessionMessages: Message[]) => {
    const lastAssistant = [...sessionMessages].reverse().find((message) => message.role === "assistant");

    if (lastAssistant) {
      const parsed = parseResponse(lastAssistant.content);
      setShowTerminal(parsed.codeBlocks.length > 0 || parsed.commands.length > 0);
      if (parsed.codeBlocks.length > 0) {
        setExtractedCode(parsed.codeBlocks[0].code);
        setCodeLanguage(parsed.codeBlocks[0].language);
      } else {
        setExtractedCode("");
        setCodeLanguage("javascript");
      }
      setTerminalCommands(parsed.commands);
      return;
    }

    setShowTerminal(false);
    setExtractedCode("");
    setCodeLanguage("javascript");
    setTerminalCommands([]);
  };

  const applySession = (session: ChatSession) => {
    setMessages(session.messages);
    setActiveSessionId(session.id);
    setShowHistory(false);
    syncTerminalFromMessages(session.messages);
  };

  const persistSession = async (msgs: Message[], preferredSessionId?: string | null) => {
    if (msgs.length === 0) {
      return null;
    }

    const title = msgs.find((message) => message.role === "user")?.content.slice(0, 50) || "Untitled";
    const response = await fetch("/api/chat-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: preferredSessionId ?? undefined,
        title,
        messages: msgs,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save chat session: ${response.status}`);
    }

    const data = (await response.json()) as ChatSessionResponse;
    upsertSessionState(data.session);
    setActiveSessionId(data.session.id);
    return data.session;
  };

  const readLegacySessions = () => {
    const sessions: ChatSession[] = [];

    try {
      const savedSessions = localStorage.getItem("chatSessions");
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions);
        if (Array.isArray(parsedSessions)) {
          sessions.push(...parsedSessions);
        }
      }
    } catch (error) {
      console.error("Failed to read legacy chat sessions:", error);
    }

    try {
      const savedHistory = localStorage.getItem("conversationHistory");
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
          sessions.unshift({
            id: `legacy-${Date.now()}`,
            title: parsedHistory.find((message: Message) => message.role === "user")?.content.slice(0, 50) || "Imported chat",
            messages: parsedHistory,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error("Failed to read legacy conversation history:", error);
    }

    return sessions.filter((session) => Array.isArray(session.messages) && session.messages.length > 0);
  };

  const loadSessionsFromServer = async () => {
    const response = await fetch("/api/chat-sessions", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load chat sessions: ${response.status}`);
    }

    let data = (await response.json()) as ChatSessionsResponse;

    if (data.sessions.length === 0) {
      const legacySessions = readLegacySessions();
      if (legacySessions.length > 0) {
        for (const legacySession of legacySessions) {
          await persistSession(legacySession.messages, null);
        }
        localStorage.removeItem("chatSessions");
        localStorage.removeItem("conversationHistory");

        const refreshedResponse = await fetch("/api/chat-sessions", { cache: "no-store" });
        if (refreshedResponse.ok) {
          data = (await refreshedResponse.json()) as ChatSessionsResponse;
        }
      }
    }

    setChatSessions(data.sessions);
    if (data.sessions.length > 0) {
      applySession(data.sessions[0]);
    }
  };

  const loadSession = (session: ChatSession) => {
    applySession(session);
  };

  const deleteSession = async (id: string) => {
    const response = await fetch(`/api/chat-sessions/${id}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(`Failed to delete chat session: ${response.status}`);
    }

    setChatSessions((previousSessions) => previousSessions.filter((session) => session.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setMessages([]);
      syncTerminalFromMessages([]);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setActiveSessionId(null);
    setShowTerminal(false); setExtractedCode(""); setTerminalCommands([]);
    setLastAudioBase64(null);
    if (window.speechSynthesis) { window.speechSynthesis.cancel(); setIsSpeechPaused(false); }
    setShowHistory(false);
  };

  const { listening, label, speechSupported, userMessage, setUserMessage, toggleListening } = useSpeechRecognition();
  const { audioRef, playAudio, isPlayingAudio } = useAudioPlayer();
  const theme = VOICE_THEMES[voice];
  const prevListeningRef = useRef(listening);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Check start screen on mount (client-only) ──
  useEffect(() => {
    const hasSeenStartScreen = localStorage.getItem("hasSeenStartScreen") === "true";
    if (!hasSeenStartScreen) {
      setShowStartScreen(true);
    }
    setStartScreenChecked(true);
    // Set random prompts on client only to avoid hydration mismatch
    setSuggestedPrompts(getRandomPrompts(3));
  }, []);

  // ── Listen for voice commands to trigger TTS ──
  useEffect(() => {
    if (!speechSupported || !userMessage) return;
    const lowerMsg = userMessage.toLowerCase();
    if (lowerMsg.includes("read this out loud") || lowerMsg.includes("use voice")) {
      setAutoPlayAudio(true);
      if (messages.length > 0 && window.speechSynthesis) {
        const cleanedMessage = stripUrlsFromText(messages[messages.length - 1]?.content || "");
        const voiceMap: { [key: string]: number } = { alloy: 0, echo: 1, fable: 2 };
        speakChunks(cleanedMessage, voiceMap[voice] ?? 1);
        setLastAudioBase64("browser-tts");
      }
      setUserMessage(""); // Clear after action
    }
  }, [userMessage, messages, speechSupported, voice]);

  const skipIntro = () => {
    setPhase("fadeout");
    setTimeout(() => { setShowStartScreen(false); localStorage.setItem("hasSeenStartScreen", "true"); }, 500);
  };

  // ── Initialize ──
  useEffect(() => {
    setIsMounted(true);
    // Load settings from localStorage
    const savedVoice = localStorage.getItem("selectedVoice") as VoiceKey || "echo";
    const savedAutoPlay = localStorage.getItem("autoPlayAudio") === "true";
    const savedPingPong = localStorage.getItem("enablePingPong") !== "false";
    const savedChess = localStorage.getItem("enableChess") !== "false";
    
    setVoice(savedVoice);
    setAutoPlayAudio(savedAutoPlay);
    setEnablePingPong(savedPingPong);
    setEnableChess(savedChess);
    void loadSessionsFromServer().catch((error) => {
      console.error("Failed to load persisted chat sessions:", error);
    });
    
    // Initialize speech synthesis
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // ── Chat logic ──
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  
  // Sync speech recognition input
  useEffect(() => {
    if (userMessage) setInput(userMessage);
  }, [userMessage]);

  // Auto-send when speech recognition stops
  useEffect(() => {
    if (prevListeningRef.current && !listening && input.trim() && !loading) {
      handleSend();
    }
    prevListeningRef.current = listening;
  }, [listening, input, loading]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
         // Allow spacebar to trigger listening in overlay mode, even if window is not focused
         const isOverlayMode = (window as any)?.locoOverlayMode || false;
        if (
          e.code === "Space" &&
          (!inputRef.current?.matches(":focus") || isOverlayMode)
        ) {
          e.preventDefault();
          toggleListening();
        }
      if ((e.key.toLowerCase() === "p" || e.code === "KeyP") && !inputRef.current?.matches(":focus")) {
        if (window.speechSynthesis?.speaking) {
          handleTogglePause();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [listening]);

  // Electron overlay mode: Ctrl+Space global shortcut triggers listening via IPC
  useEffect(() => {
    const api = (window as any)?.electronAPI;
    if (api?.onStartListening) {
      api.onStartListening(() => {
        if (!listening) toggleListening();
      });
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    
    try {
      const updated: Message[] = [...messages, { role: "user", content: input }];
      setMessages(updated);
      setInput("");
      setUserMessage("");

      // Check for game triggers
      if (enablePingPong && input.toLowerCase().includes("ping pong")) {
        router.push("/experimental/game");
        return;
      }
      if (enableChess && input.toLowerCase().includes("chess")) {
        router.push("/experimental/chess");
        return;
      }

      const session = await persistSession(updated, activeSessionId);
      const result = await callAIAPI(updated, voice, session?.id ?? activeSessionId);
      
      if (!result.success || !result.data) {
        setLoading(false);
        return;
      }

      const message = result.data.message || "No response";
      const parsed = parseResponse(message);
      
      const hasCode = parsed.codeBlocks.length > 0 || parsed.commands.length > 0;
      setShowTerminal(hasCode);
      
      if (parsed.codeBlocks.length > 0) {
        setExtractedCode(parsed.codeBlocks[0].code);
        setCodeLanguage(parsed.codeBlocks[0].language);
      }
      
      setTerminalCommands(parsed.commands);
      const nextMessages: Message[] = [...updated, { role: "assistant", content: message }];
      setMessages(nextMessages);
      await persistSession(nextMessages, session?.id ?? activeSessionId);
      
      // TTS
      if (autoPlayAudio && window.speechSynthesis) {
        setIsSpeechPaused(false);
        const cleanedMessage = stripUrlsFromText(message);
        const voiceMap: { [key: string]: number } = { alloy: 0, echo: 1, fable: 2 };
        speakChunks(cleanedMessage, voiceMap[voice] ?? 1);
        setLastAudioBase64("browser-tts");
      } else if (result.data.audio) {
        setLastAudioBase64(result.data.audio);
        if (autoPlayAudio) {
          playAudio(result.data.audio);
        }
      }
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleClear = () => { 
    setMessages([]); 
    setActiveSessionId(null);
    setShowTerminal(false);
    setExtractedCode("");
    setCodeLanguage("javascript");
    setTerminalCommands([]);
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeechPaused(false);
    }
    setLastAudioBase64(null);
  };

  const handleUndo = () => {
    if (messages.length < 2) return;
    const newMessages = messages.slice(0, -2);
    setMessages(newMessages);
    syncTerminalFromMessages(newMessages);
    if (activeSessionId && newMessages.length > 0) {
      void persistSession(newMessages, activeSessionId).catch((error) => {
        console.error("Failed to persist updated chat after undo:", error);
      });
    }
    if (activeSessionId && newMessages.length === 0) {
      setActiveSessionId(null);
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeechPaused(false);
    }
    setLastAudioBase64(null);
  };

  const handleTogglePause = () => {
    if (!window.speechSynthesis) return;
    if (isSpeechPaused) {
      window.speechSynthesis.resume();
      setIsSpeechPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsSpeechPaused(true);
    }
  };

  const handleReplay = () => {
    if (lastAudioBase64 === "browser-tts") {
      const lastMessage = messages.length > 0 ? messages[messages.length - 1]?.content : "";
      if (lastMessage && window.speechSynthesis) {
        const cleanedMessage = stripUrlsFromText(lastMessage);
        const voiceMap: { [key: string]: number } = { alloy: 0, echo: 1, fable: 2 };
        speakChunks(cleanedMessage, voiceMap[voice] ?? 1);
        setIsSpeechPaused(false);
      }
    } else if (lastAudioBase64) {
      playAudio(lastAudioBase64);
    }
  };

  const handleCopy = async () => {
    try {
      if (isElectron) {
        await clipboard.write(extractedCode);
      } else {
        await navigator.clipboard.writeText(extractedCode);
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy code:", error);
    }
  };

  // ── Loading state while checking localStorage ──
  if (!startScreenChecked) {
    return (
      <div className="flex flex-col bg-background items-center justify-center" style={{ height: isElectron ? "calc(100vh - 32px)" : "100vh" }}>
        <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center animate-pulse">
          <span className="text-primary font-bold text-lg">L</span>
        </div>
      </div>
    );
  }

  // ── Start Screen ──
  if (showStartScreen) {
    return (
      <AnimatePresence>
        {phase !== "fadeout" && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background overflow-hidden"
            style={{ height: isElectron ? "calc(100vh - 32px)" : "100vh" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            {PARTICLES.map((p, i) => (
              <motion.div
                key={i}
                className="absolute w-[3px] h-[3px] rounded-full bg-primary/60"
                style={{ left: p.left, top: p.top }}
                animate={{ y: [0, -30, 0], opacity: [p.opacity, p.opacity * 0.3, p.opacity] }}
                transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
              />
            ))}

            <div className="flex flex-col items-center gap-8">
              <AnimatePresence>
                {phase === "eyes" && (
                  <motion.div
                    className="flex gap-6"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: "backOut" }}
                  >
                    {[0, 1].map((eyeIdx) => (
                      <motion.div
                        key={eyeIdx}
                        className="w-20 h-28 rounded-[50%] bg-primary/80 relative"
                        style={{
                          boxShadow: "0 0 40px hsl(var(--primary) / 0.5), 0 0 80px hsl(var(--primary) / 0.2)",
                          animation: "blink 4s ease-in-out infinite, glow-pulse 3s ease-in-out infinite",
                        }}
                      >
                        <motion.div
                          className="absolute w-4 h-4 rounded-full bg-primary-foreground/90"
                          animate={{ x: eyePos.x, y: eyePos.y }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          style={{ top: "35%", left: "50%", marginLeft: -8, marginTop: -8 }}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div className="text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
                <h1 className="text-7xl font-bold tracking-tight text-primary" style={{ animation: "text-glow 3s ease-in-out infinite" }}>Loco</h1>
                {phase === "eyes" && (
                  <motion.p className="mt-4 text-muted-foreground text-lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                    Your AI Assistant is waking up...
                  </motion.p>
                )}
              </motion.div>

              {phase === "eyes" && (
                <motion.button
                  className="px-6 py-2 rounded-full border border-primary/40 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 hover:border-primary transition-all"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                  onClick={skipIntro}
                >
                  Skip Intro →
                </motion.button>
              )}
            </div>

            {phase === "eyes" && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-48 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full origin-left" style={{ animation: "loading-bar 3s ease-in-out forwards" }} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ── Main Chat UI ──
  return (
    <div className="flex flex-col bg-background" style={{ height: isElectron ? "calc(100vh - 32px)" : "100vh" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold text-lg">L</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">Loco</h1>
            <p className="text-xs text-muted-foreground">
              {messages.length > 0 ? `${Math.floor(messages.length / 2)} messages` : "Ready to chat"} • {voice}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Audio controls */}
          {lastAudioBase64 && (
            <>
              {lastAudioBase64 === "browser-tts" && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleTogglePause}
                  disabled={!window.speechSynthesis?.speaking}
                  title={isSpeechPaused ? "Resume" : "Pause"}
                >
                  {isSpeechPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleReplay}
                disabled={window.speechSynthesis?.speaking || isPlayingAudio}
                title="Replay"
              >
                <Volume2 className="w-4 h-4" />
              </Button>
            </>
          )}
          {messages.length >= 2 && (
            <Button variant="ghost" size="icon" onClick={handleUndo} disabled={loading} title="Undo">
              <Undo2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => router.push("/settings")} title="Settings">
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(v => !v)} title="Chat History" className={`gap-1.5 ${showHistory ? "text-primary" : "text-muted-foreground"}`}>
            <History className="w-4 h-4" />
            History
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowTerminal((v) => !v)} title="Toggle Terminal Panel" className="gap-1.5 text-muted-foreground">
            {showTerminal ? "◀ Close Terminal" : "▶ Terminal"}
          </Button>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1.5 text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </Button>
          )}
        </div>
      </header>

      {/* Status Bar */}
      {isMounted && (autoPlayAudio || (label && label !== "tap to speak" && label !== "speech not supported")) && (
        <div className="px-6 py-2 border-b border-border/30 bg-card/30 flex items-center gap-4 text-xs text-muted-foreground">
          {autoPlayAudio && <span className="flex items-center gap-1"><Volume2 className="w-3 h-3" /> Auto-play</span>}
          {label && label !== "tap to speak" && label !== "speech not supported" && (
            <span className={`flex items-center gap-1 ${label === "listening..." ? "text-primary" : (label.includes("error") || label.includes("no ") || label.includes("denied")) ? "text-destructive" : ""}`}>
              {label === "listening..." && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
              {label}
            </span>
          )}
          <div className="flex-1" />
          <span className="opacity-60">Space: Record {window.speechSynthesis?.speaking && "• P: Pause"}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">

        {/* History Sidebar */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, x: -60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-[280px] border-r border-border/50 bg-card/80 backdrop-blur-xl flex flex-col flex-shrink-0"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <span className="text-sm font-semibold text-foreground">Chat History</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="px-3 py-2 border-b border-border/30">
                <Button variant="surface" size="sm" className="w-full gap-2 text-xs" onClick={startNewChat}>
                  <Plus className="w-3.5 h-3.5" /> New Chat
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto py-2">
                {chatSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-2 py-8">
                    <MessageSquare className="w-8 h-8 opacity-20" />
                    <p>No saved chats yet</p>
                  </div>
                ) : (
                  chatSessions.map(session => (
                    <div
                      key={session.id}
                      className={`group flex items-start justify-between gap-2 mx-2 mb-1 px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-muted/60 ${
                        activeSessionId === session.id ? "bg-primary/10 border border-primary/20" : ""
                      }`}
                      onClick={() => loadSession(session)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{session.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(session.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {" · "}{Math.floor(session.messages.length / 2)} msg{Math.floor(session.messages.length / 2) !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all flex-shrink-0 mt-0.5"
                        onClick={e => {
                          e.stopPropagation();
                          void deleteSession(session.id).catch((error) => {
                            console.error("Failed to delete chat session:", error);
                          });
                        }}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-6">
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                    <span className="text-4xl">💬</span>
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">Start a conversation</h2>
                  <p className="text-muted-foreground text-sm">Try asking a question or use voice input</p>
                </motion.div>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                  {suggestedPrompts.map((prompt, i) => (
                    <motion.button key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
                      onClick={() => setInput(prompt.text)}
                      className="px-4 py-2 rounded-full bg-surface border border-border text-sm text-secondary-foreground hover:bg-surface-hover hover:border-primary/30 transition-all"
                    >
                      {prompt.emoji} {prompt.text.split(" ").slice(0, 3).join(" ")}...
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-primary text-xs font-bold">L</span>
                      </div>
                    )}
                    <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm text-card-foreground"
                    }`}>
                      {msg.role === "assistant"
                        ? (
                            <ReactMarkdown components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                              pre: ({ children }) => <>{children}</>,
                              ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2">{children}</ol>,
                              a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:text-primary transition-colors">{children}</a>,
                              blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/50 pl-3 my-2 text-muted-foreground italic">{children}</blockquote>,
                              h1: ({ children }) => <h1 className="text-xl font-bold mb-2 text-accent">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-semibold mb-2">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-semibold mb-1">{children}</h3>,
                            }}>{parseResponse(msg.content).cleanText}</ReactMarkdown>
                          )
                        : msg.content}
                    </div>
                  </motion.div>
                ))}

                {loading && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-primary text-xs font-bold">L</span>
                    </div>
                    <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((j) => (
                          <motion.div key={j} className="w-2 h-2 rounded-full bg-primary/60" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, delay: j * 0.2, repeat: Infinity }} />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-6 py-4 border-t border-border/50 bg-card/30 backdrop-blur-xl">
            <div className="max-w-3xl mx-auto flex gap-3">
              <input 
                ref={inputRef} 
                type="text" 
                value={input} 
                onChange={(e) => { setInput(e.target.value); setUserMessage(e.target.value); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                disabled={loading} 
                placeholder="Ask anything..."
                className="flex-1 px-4 py-3 rounded-xl bg-input/50 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all disabled:opacity-50"
              />
              <Button onClick={handleSend} disabled={loading || !input.trim()} variant="glow" className="px-5">
                {loading ? (
                  <div className="flex gap-1">
                    {[0, 1, 2].map((j) => <motion.span key={j} className="w-1.5 h-1.5 rounded-full bg-primary-foreground" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, delay: j * 0.15, repeat: Infinity }} />)}
                  </div>
                ) : <Send className="w-4 h-4" />}
              </Button>
              {speechSupported && (
                <Button 
                  variant={listening ? "glow" : "surface"} 
                  size="icon" 
                  onClick={toggleListening}
                  disabled={loading}
                  title="Voice input"
                  className={listening ? "animate-pulse" : ""}
                >
                  <Mic className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Terminal Panel */}
        <AnimatePresence>
          {showTerminal && (
            <motion.div
              initial={{ opacity: 0, x: 60 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 60 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-[420px] border-l border-border/50 bg-card/80 backdrop-blur-xl flex flex-col flex-shrink-0"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {extractedCode && terminalCommands.length > 0 ? "Code & Commands" : extractedCode ? "Code" : "Commands"}
                  </span>
                  {codeLanguage && (
                    <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary text-xs font-mono">{codeLanguage}</span>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowTerminal(false)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {extractedCode && (
                  <div className="mb-4">
                    <div className="rounded-xl bg-background border border-border p-4 overflow-x-auto max-h-[350px]">
                      <pre className="font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">{extractedCode}</pre>
                    </div>
                    <Button onClick={handleCopy} variant="surface" size="sm" className="mt-3 gap-1.5">
                      {copied ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Code</>}
                    </Button>
                  </div>
                )}
                
                {terminalCommands.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-primary mb-2 uppercase tracking-wider">Terminal Commands</div>
                    {terminalCommands.map((cmd, i) => (
                      <div key={i} className="mb-2 font-mono text-xs text-foreground bg-background/50 p-3 rounded-lg border-l-2 border-primary">
                        <span className="text-primary/70">$ </span>{cmd}
                      </div>
                    ))}
                  </div>
                )}
                
                {!extractedCode && terminalCommands.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                    <span className="text-4xl mb-4 opacity-30">📟</span>
                    <p className="font-medium mb-2">No code blocks found</p>
                    <p className="text-xs opacity-60">Ask the AI to provide code wrapped in markdown blocks</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} autoPlay controls style={{ display: "none" }} />

      {/* Toast Notification */}
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50"
          >
            <Check className="w-5 h-5" />
            <span className="font-medium">Code copied to clipboard!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
