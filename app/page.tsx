"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import CommandTerminal from "@/components/CommandTerminal";
import { useSpeechRecognition } from "@/tools/hooks/useSpeechRecognition";
import { useAudioPlayer } from "@/tools/hooks/useAudioPlayer";
import { useElectron } from "@/tools/hooks/useElectron";
import { parseResponse } from "@/tools/hooks/utils/messageParser";
import { VOICE_THEMES, VoiceKey } from "@/tools/hooks/utils/themes";
import { callAIAPI } from "@/tools/hooks/utils/apiClient";

export default function Home() {
  const router = useRouter();
  const { isElectron } = useElectron();
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [startScreenPhase, setStartScreenPhase] = useState<'intro' | 'eyes' | 'fadeout'>('intro');
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 });
  const [voice, setVoice] = useState<VoiceKey>("echo");
  const [loading, setLoading] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [extractedCode, setExtractedCode] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const [terminalCommands, setTerminalCommands] = useState<string[]>([]);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [lastAudioBase64, setLastAudioBase64] = useState<string | null>(null);
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<Array<{ emoji: string; text: string }>>([]);
  const [enablePingPong, setEnablePingPong] = useState(true);
  const [enableChess, setEnableChess] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  
  const allPrompts: Array<{ emoji: string; text: string }> = [
    { 
      emoji: "📝", 
      text: "Build a React Todo List component with add, delete, and localStorage persistence" 
    },
    { 
      emoji: "💡", 
      text: "Explain React hooks (useState, useEffect, useRef) with practical examples" 
    },
    { 
      emoji: "🐛", 
      text: "Help me debug: 'TypeError: undefined is not a function' in JavaScript" 
    },
    { 
      emoji: "🎨", 
      text: "Create a responsive Navbar component using React and Tailwind CSS" 
    },
    { 
      emoji: "⚡", 
      text: "Optimize this React component for performance (re-renders, memoization, keys)" 
    },
    { 
      emoji: "📚", 
      text: "Explain the difference between var, let, and const with real examples" 
    },
    { 
      emoji: "🔧", 
      text: "Set up a Next.js project with TypeScript and ESLint step-by-step" 
    },
    { 
      emoji: "🌐", 
      text: "Build a React form with validation using React Hook Form or custom validation" 
    },
    { 
      emoji: "📊", 
      text: "Create a data visualization dashboard using Chart.js in React" 
    },
    { 
      emoji: "🚀", 
      text: "Deploy a Next.js app to Vercel with environment variables configured" 
    }
  ];
  
  const { listening, label, speechSupported, userMessage, setUserMessage, toggleListening, isWhisperActive } = useSpeechRecognition();
  const { audioRef, playAudio, isPlayingAudio } = useAudioPlayer();
  const theme = VOICE_THEMES[voice];
  const prevListeningRef = useRef(listening);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Start screen animation logic
  useEffect(() => {
    // Check if user has seen the start screen before
    const hasSeenStartScreen = localStorage.getItem('hasSeenStartScreen');
    
    if (hasSeenStartScreen === 'true') {
      setShowStartScreen(false);
      return;
    }

    // Phase 1: Show intro text
    const introTimer = setTimeout(() => {
      setStartScreenPhase('eyes');
    }, 1500);

    // Phase 2: Animate eyes looking around
    const eyesTimer = setTimeout(() => {
      setStartScreenPhase('fadeout');
    }, 4500);

    // Phase 3: Fade out and show main app
    const fadeoutTimer = setTimeout(() => {
      setShowStartScreen(false);
      localStorage.setItem('hasSeenStartScreen', 'true');
    }, 5500);

    return () => {
      clearTimeout(introTimer);
      clearTimeout(eyesTimer);
      clearTimeout(fadeoutTimer);
    };
  }, []);

  // Eye movement animation
  useEffect(() => {
    if (startScreenPhase !== 'eyes') return;

    const positions = [
      { x: -20, y: 0 },   // Look left
      { x: 0, y: 0 },     // Center
      { x: 20, y: 0 },    // Look right
      { x: 0, y: 0 },     // Center
      { x: -20, y: 0 },   // Look left again
      { x: 20, y: 0 },    // Look right again
      { x: 0, y: -12 },   // Look up
      { x: 0, y: 0 },     // Center
      { x: -15, y: -8 },  // Look up-left
      { x: 15, y: -8 },   // Look up-right
      { x: 0, y: 0 },     // Center
    ];

    let currentIndex = 0;

    const interval = setInterval(() => {
      setEyePosition(positions[currentIndex]);
      currentIndex = (currentIndex + 1) % positions.length;
    }, 450);

    return () => clearInterval(interval);
  }, [startScreenPhase]);

  const skipStartScreen = () => {
    setStartScreenPhase('fadeout');
    setTimeout(() => {
      setShowStartScreen(false);
      localStorage.setItem('hasSeenStartScreen', 'true');
    }, 500);
  };

  // Function to strip URLs and links from text for speech (prevents reading links aloud)
  const stripUrlsFromText = (text: string): string => {
    let cleaned = text;
    
    // 1. Remove markdown links [text](url) → keep text only
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    
    // 2. Remove HTML links <a href="...">text</a> → keep text
    cleaned = cleaned.replace(/<a\s+href="[^"]*"[^>]*>([^<]*)<\/a>/gi, "$1");
    
    // 3. Remove http/https URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s)]+/g, "");
    
    // 4. Remove www URLs
    cleaned = cleaned.replace(/www\.[^\s)]+/g, "");
    
    // 5. Clean up multiple spaces and newlines
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    
    return cleaned;
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistory, loading]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Save conversation history to localStorage whenever it changes
  useEffect(() => {
    if (isMounted && conversationHistory.length > 0) {
      try {
        localStorage.setItem("conversationHistory", JSON.stringify(conversationHistory));
      } catch (error) {
        console.error("Failed to save conversation history:", error);
      }
    }
  }, [conversationHistory, isMounted]);

  useEffect(() => {
    // Initialize Speech Synthesis voices and shuffle prompts on mount
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        // Voices loaded, component will re-render if needed
      };
      // Trigger voices loading
      window.speechSynthesis.getVoices();
    }
    
    // Load settings from localStorage
    const savedVoice = localStorage.getItem("selectedVoice") as VoiceKey || "echo";
    const savedAutoPlay = localStorage.getItem("autoPlayAudio") === "true";
    const savedPingPong = localStorage.getItem("enablePingPong") !== "false";
    const savedChess = localStorage.getItem("enableChess") !== "false";
    
    // Load conversation history from localStorage
    try {
      const savedHistory = localStorage.getItem("conversationHistory");
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
          setConversationHistory(parsedHistory);
        }
      }
    } catch (error) {
      console.error("Failed to load conversation history:", error);
    }
    
    setVoice(savedVoice);
    setAutoPlayAudio(savedAutoPlay);
    setEnablePingPong(savedPingPong);
    setEnableChess(savedChess);
    
    // Shuffle and select 3 random prompts on page load
    const shuffled = [...allPrompts].sort(() => Math.random() - 0.5);
    setSuggestedPrompts(shuffled.slice(0, 3));
  }, []);

  useEffect(() => {
    if (prevListeningRef.current && !listening && userMessage.trim() && !loading) {
      handleSendMessage();
    }
    prevListeningRef.current = listening;
  }, [listening, userMessage, loading]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space = Start/stop recording
      if (e.code === "Space" && !inputRef.current?.matches(":focus")) {
        e.preventDefault();
        toggleListening();
      }
      
      // P = Pause/resume speech
      if ((e.key.toLowerCase() === "p" || e.code === "KeyP") && !inputRef.current?.matches(":focus")) {
        if (window.speechSynthesis?.speaking) {
          handleTogglePause();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [listening]);

  const handleSendMessage = async () => {
    if (!userMessage.trim()) return;
    setLoading(true);
    
    try {
      const updatedHistory = [...conversationHistory, { role: "user", content: userMessage }];
      setConversationHistory(updatedHistory);

      // Check if user wants to play ping pong
      if (enablePingPong && userMessage.toLowerCase().includes("ping pong")) {
        router.push("/game");
        return;
      }

      // Check if user wants to play chess
      if (enableChess && userMessage.toLowerCase().includes("chess")) {
        router.push("/chess");
        return;
      }

      const result = await callAIAPI(updatedHistory, voice);
      
      if (!result.success || !result.data) {
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
      setConversationHistory([...updatedHistory, { role: "assistant", content: message }]);
      
      // Use browser Web Speech API for free TTS
      if (autoPlayAudio && window.speechSynthesis) {
        window.speechSynthesis.cancel(); // Cancel any ongoing speech
        setIsSpeechPaused(false);
        const cleanedMessage = stripUrlsFromText(message);
        const utterance = new SpeechSynthesisUtterance(cleanedMessage);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        // Map voice names to browser speech synthesis voices
        const voiceMap: { [key: string]: number } = {
          alloy: 0,
          echo: 1,
          fable: 2,
        };
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          utterance.voice = voices[voiceMap[voice] % voices.length];
        }
        window.speechSynthesis.speak(utterance);
        setLastAudioBase64("browser-tts"); // Mark that audio is being played
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
      setUserMessage("");
      inputRef.current?.focus();
    }
  };

  const handleUndoMessage = () => {
    if (conversationHistory.length < 2) return;
    const newHistory = conversationHistory.slice(0, -2);
    setConversationHistory(newHistory);
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeechPaused(false);
    }
    setLastAudioBase64(null);
  };

  const handleClearChat = () => {
    setConversationHistory([]);
    try {
      localStorage.removeItem("conversationHistory");
    } catch (error) {
      console.error("Failed to clear conversation history:", error);
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeechPaused(false);
    }
    setLastAudioBase64(null);
    setShowTerminal(false);
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

  const handleReplayAudio = () => {
    if (lastAudioBase64 === "browser-tts") {
      const lastMessage = conversationHistory.length > 0 ? conversationHistory[conversationHistory.length - 1]?.content : "";
      if (lastMessage && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const cleanedMessage = stripUrlsFromText(lastMessage);
        const utterance = new SpeechSynthesisUtterance(cleanedMessage);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        const voiceMap: { [key: string]: number } = {
          alloy: 0,
          echo: 1,
          fable: 2,
        };
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          utterance.voice = voices[voiceMap[voice] % voices.length];
        }
        window.speechSynthesis.speak(utterance);
        setIsSpeechPaused(false);
      }
    } else {
      playAudio(lastAudioBase64!);
    }
  };

  // Start Screen Component
  if (showStartScreen) {
    return (
      <div style={{
        height: isElectron ? "calc(100vh - 32px)" : "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0a0e27 100%)",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
        overflow: "hidden",
        opacity: startScreenPhase === 'fadeout' ? 0 : 1,
        transition: "opacity 1s ease"
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
          
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }
          
          @keyframes glow {
            0%, 100% { 
              box-shadow: 0 0 30px rgba(147, 51, 234, 0.4), 
                          0 0 60px rgba(147, 51, 234, 0.2),
                          inset 0 0 20px rgba(147, 51, 234, 0.1); 
            }
            50% { 
              box-shadow: 0 0 50px rgba(147, 51, 234, 0.6), 
                          0 0 100px rgba(147, 51, 234, 0.3),
                          inset 0 0 30px rgba(147, 51, 234, 0.2); 
            }
          }
          
          @keyframes blink {
            0%, 90%, 100% { transform: scaleY(1); }
            95% { transform: scaleY(0.1); }
          }
          
          @keyframes textGlow {
            0%, 100% { text-shadow: 0 0 20px rgba(147, 51, 234, 0.6); }
            50% { text-shadow: 0 0 40px rgba(147, 51, 234, 0.9), 0 0 60px rgba(147, 51, 234, 0.6); }
          }
          
          .particle {
            position: absolute;
            width: 3px;
            height: 3px;
            background: rgba(147, 51, 234, 0.6);
            border-radius: 50%;
            pointer-events: none;
          }
        `}</style>

        {/* Animated background particles */}
        {[...Array(40)].map((_, i) => {
          // Use deterministic values based on index to avoid hydration mismatch
          const seed1 = ((i * 17 + 13) % 100);
          const seed2 = ((i * 23 + 7) % 100);
          const seed3 = ((i * 31 + 11) % 40) / 10 + 3; // 3-7s
          const seed4 = ((i * 37 + 3) % 20) / 10; // 0-2s
          const seed5 = ((i * 41 + 5) % 60) / 100 + 0.2; // 0.2-0.8
          return (
            <div
              key={i}
              className="particle"
              style={{
                left: `${seed1}%`,
                top: `${seed2}%`,
                animation: `float ${seed3}s ease-in-out infinite`,
                animationDelay: `${seed4}s`,
                opacity: seed5
              }}
            />
          );
        })}

        {/* Main content */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "50px",
          zIndex: 10
        }}>
          {/* Eyes Container - Simple Purple Ovals */}
          {startScreenPhase !== 'intro' && (
            <div style={{
              display: "flex",
              gap: "80px",
              alignItems: "center",
              animation: "float 3s ease-in-out infinite"
            }}>
              {/* Left Eye - Simple Purple Oval */}
              <div style={{
                width: "100px",
                height: "160px",
                background: "linear-gradient(135deg, #9333ea 0%, #7c3aed 50%, #6d28d9 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "glow 2s ease-in-out infinite, blink 4s ease-in-out infinite",
                position: "relative",
                transform: `translate(${eyePosition.x}px, ${eyePosition.y}px)`,
                transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: "0 0 40px rgba(147, 51, 234, 0.5), inset 0 0 30px rgba(255, 255, 255, 0.1)"
              }}>
                {/* White highlight */}
                <div style={{
                  position: "absolute",
                  top: "20%",
                  left: "30%",
                  width: "25px",
                  height: "35px",
                  background: "rgba(255, 255, 255, 0.4)",
                  borderRadius: "50%",
                  filter: "blur(8px)"
                }} />
              </div>

              {/* Right Eye - Simple Purple Oval */}
              <div style={{
                width: "100px",
                height: "160px",
                background: "linear-gradient(135deg, #9333ea 0%, #7c3aed 50%, #6d28d9 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "glow 2s ease-in-out infinite, blink 4s ease-in-out infinite",
                animationDelay: "0.1s",
                position: "relative",
                transform: `translate(${eyePosition.x}px, ${eyePosition.y}px)`,
                transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: "0 0 40px rgba(147, 51, 234, 0.5), inset 0 0 30px rgba(255, 255, 255, 0.1)"
              }}>
                {/* White highlight */}
                <div style={{
                  position: "absolute",
                  top: "20%",
                  left: "30%",
                  width: "25px",
                  height: "35px",
                  background: "rgba(255, 255, 255, 0.4)",
                  borderRadius: "50%",
                  filter: "blur(8px)"
                }} />
              </div>
            </div>
          )}

          {/* Text */}
          <div style={{
            textAlign: "center",
            marginTop: startScreenPhase === 'intro' ? "0" : "30px"
          }}>
            <h1 style={{
              fontSize: startScreenPhase === 'intro' ? "72px" : "56px",
              fontWeight: 900,
              background: "linear-gradient(135deg, #a855f7 0%, #9333ea 50%, #7c3aed 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              marginBottom: "16px",
              letterSpacing: "-0.02em",
              animation: "textGlow 2s ease-in-out infinite",
              transition: "font-size 0.5s ease"
            }}>
              Loco
            </h1>
            
            {startScreenPhase !== 'intro' && (
              <p style={{
                fontSize: "18px",
                color: "rgba(168, 85, 247, 0.8)",
                fontWeight: 400,
                letterSpacing: "0.05em",
                animation: "fadeIn 1s ease"
              }}>
                Your AI Assistant is waking up...
              </p>
            )}
          </div>

          {/* Skip button */}
          {startScreenPhase === 'eyes' && (
            <button
              onClick={skipStartScreen}
              style={{
                marginTop: "40px",
                padding: "12px 32px",
                background: "rgba(147, 51, 234, 0.15)",
                border: "2px solid rgba(147, 51, 234, 0.4)",
                borderRadius: "12px",
                color: "#a855f7",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.3s ease",
                backdropFilter: "blur(10px)",
                letterSpacing: "0.05em"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(147, 51, 234, 0.25)";
                e.currentTarget.style.borderColor = "#9333ea";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 20px rgba(147, 51, 234, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(147, 51, 234, 0.15)";
                e.currentTarget.style.borderColor = "rgba(147, 51, 234, 0.4)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              Skip Intro →
            </button>
          )}
        </div>

        {/* Loading bar */}
        {startScreenPhase === 'eyes' && (
          <div style={{
            position: "absolute",
            bottom: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "300px",
            height: "3px",
            background: "rgba(147, 51, 234, 0.2)",
            borderRadius: "10px",
            overflow: "hidden"
          }}>
            <div style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg, #9333ea 0%, #a855f7 100%)",
              animation: "loading 3s ease-in-out",
              transformOrigin: "left"
            }} />
          </div>
        )}

        <style>{`
          @keyframes loading {
            from { transform: scaleX(0); }
            to { transform: scaleX(1); }
          }
          
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  // Main App UI (your existing code continues here...)
  return (
    <div style={{ 
      height: isElectron ? "calc(100vh - 32px)" : "100vh", 
      display: "flex", 
      flexDirection: "column", 
      background: theme.bgGradient, 
      fontFamily: "'Inter', 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", 
      transition: "background 0.8s ease",
      overflow: "hidden"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        * {
          box-sizing: border-box;
        }
        
        @keyframes pulse { 
          0%, 100% { opacity: 1; } 
          50% { opacity: 0.6; } 
        }
        
        @keyframes slideInRight { 
          from { opacity: 0; transform: translateX(100%); } 
          to { opacity: 1; transform: translateX(0); } 
        }
        
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .terminal-panel { 
          background: rgba(6,10,30,0.95); 
          border: 1px solid; 
          border-radius: 16px; 
          padding: 24px; 
          height: 550px; 
          width: 420px; 
          display: flex; 
          flex-direction: column; 
          overflow: hidden; 
          animation: slideInRight 0.4s ease; 
          backdrop-filter: blur(24px); 
          box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1) inset; 
          flex-shrink: 0; 
        }
        
        .terminal-content { 
          flex: 1; 
          overflow-y: auto; 
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Courier New', monospace; 
          font-size: 13px; 
          line-height: 1.6; 
          padding: 16px; 
          border-radius: 10px; 
          background: rgba(0,0,0,0.4); 
          border: 1px solid rgba(255,255,255,0.05);
        }
        
        .terminal-content::-webkit-scrollbar {
          width: 8px;
        }
        
        .terminal-content::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
          border-radius: 4px;
        }
        
        .terminal-content::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 4px;
        }
        
        .terminal-content::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.3);
        }
        
        .input-container { 
          display: flex; 
          gap: 12px; 
          width: 100%; 
        }
        
        .btn {
          padding: 10px 18px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
          font-size: 13px;
          transition: all 0.2s ease;
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        }
        
        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        
        .btn:active:not(:disabled) {
          transform: translateY(0);
        }
        
        .btn:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        
        .btn-primary {
          background: ${theme.accentColor};
          color: #000;
        }
        
        .btn-secondary {
          background: rgba(255,255,255,0.08);
          color: ${theme.textColor};
          border: 1px solid ${theme.borderColor}40;
        }
        
        .btn-ghost {
          background: transparent;
          color: ${theme.textColor};
          border: 1px solid ${theme.borderColor}40;
        }
        
        .chat-message {
          animation: fadeIn 0.3s ease;
          max-width: 75%;
          padding: 16px 20px;
          border-radius: 18px;
          line-height: 1.7;
          font-size: 14.5px;
          word-wrap: break-word;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .chat-message.user {
          background: ${theme.accentColor};
          color: #000;
          border-bottom-right-radius: 4px;
        }
        
        .chat-message.assistant {
          background: rgba(6,10,30,0.9);
          color: ${theme.textColor};
          border: 1px solid ${theme.borderColor}40;
          border-bottom-left-radius: 4px;
          backdrop-filter: blur(10px);
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 20px;
          opacity: 0.6;
        }
        
        .empty-state-icon {
          font-size: 64px;
          opacity: 0.4;
        }
        
        .suggestion-chip {
          padding: 8px 16px;
          background: rgba(255,255,255,0.05);
          border: 1px solid ${theme.borderColor}40;
          border-radius: 20px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: ${theme.textColor};
        }
        
        .suggestion-chip:hover {
          background: rgba(255,255,255,0.1);
          border-color: ${theme.accentColor}60;
          transform: translateY(-1px);
        }
      `}</style>

      {/* Header */}
      <div style={{ 
        padding: "20px 24px", 
        borderBottom: `1px solid ${theme.borderColor}20`, 
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "rgba(6,10,30,0.6)",
        backdropFilter: "blur(20px)"
      }}>
        <div>
          <h1 style={{ 
            fontSize: "20px", 
            fontWeight: 600, 
            color: theme.textColor, 
            margin: 0,
            letterSpacing: "-0.02em"
          }}>
            Loco
          </h1>
          <p style={{ 
            fontSize: "12px", 
            fontWeight: 400, 
            color: theme.accentColor, 
            margin: "4px 0 0 0",
            opacity: 0.8
          }}>
            Voice: {voice.charAt(0).toUpperCase() + voice.slice(1)} • {conversationHistory.length / 2} messages
          </p>
        </div>
        
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button 
            onClick={() => router.push("/settings")}
            className="btn btn-ghost"
            title="Settings"
          >
            ⚙️
          </button>
          
          {conversationHistory.length > 0 && (
            <button 
              onClick={handleClearChat}
              className="btn btn-ghost"
              title="Clear chat"
            >
              🗑️ Clear
            </button>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <div style={{ 
        padding: "12px 24px", 
        borderBottom: `1px solid ${theme.borderColor}20`,
        background: "rgba(6,10,30,0.4)",
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        alignItems: "center"
      }}>
        {lastAudioBase64 && lastAudioBase64 === "browser-tts" && (
          <button 
            onClick={handleTogglePause}
            disabled={!window.speechSynthesis?.speaking}
            className="btn btn-secondary"
          >
            {isSpeechPaused ? "⏯️ Resume" : "⏸️ Pause"}
          </button>
        )}
        
        {lastAudioBase64 && (
          <button 
            onClick={handleReplayAudio}
            disabled={window.speechSynthesis?.speaking || isPlayingAudio}
            className="btn btn-secondary"
          >
            {window.speechSynthesis?.speaking || isPlayingAudio ? "🎵 Speaking..." : "🔊 Replay"}
          </button>
        )}
        
        {conversationHistory.length >= 2 && (
          <button 
            onClick={handleUndoMessage}
            disabled={loading}
            className="btn btn-ghost"
          >
            ↶ Undo
          </button>
        )}
        
        <div style={{ flex: 1 }} />
        
        <div style={{ 
          fontSize: "12px", 
          color: theme.textColor, 
          opacity: 0.6,
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          {autoPlayAudio && <span>🔊 Auto-play enabled</span>}
          {label !== "tap to speak" && label !== "speech not supported" && (
            <span style={{ 
              color: (label.includes("error") || label.includes("no ") || label.includes("denied") || label.includes("disabled")) ? "#ff6b6b" : theme.accentColor,
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}>
              {label === "listening..." ? "🎤" : "ℹ️"} {label}
            </span>
          )}
        </div>

        {/* Keyboard Shortcuts Hints */}
        {isMounted && (
          <div style={{ 
            fontSize: "11px", 
            color: theme.textColor, 
            opacity: 0.5,
            display: "flex",
            alignItems: "center",
            gap: "12px",
            borderLeft: `1px solid ${theme.borderColor}30`,
            paddingLeft: "12px"
          }}>
            <span title="Press Space to start/stop recording">⌨️ Space: Record</span>
            {window.speechSynthesis?.speaking && (
              <span title="Press P to pause/resume speech">⌨️ P: Pause</span>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div style={{ 
        display: "flex", 
        flex: 1, 
        overflow: "hidden", 
        gap: "24px", 
        padding: "24px",
        position: "relative"
      }}>
        {/* Chat Area */}
        <div style={{ 
          flex: 1, 
          display: "flex", 
          flexDirection: "column", 
          overflow: "hidden",
          minWidth: 0
        }}>
          <div style={{ 
            flex: 1, 
            overflowY: "auto", 
            display: "flex", 
            flexDirection: "column", 
            gap: "20px", 
            paddingRight: "12px" 
          }}>
            {conversationHistory.length === 0 && !loading && (
              <div className="empty-state">
                <div className="empty-state-icon">💬</div>
                <div style={{ 
                  fontSize: "18px", 
                  fontWeight: 600, 
                  color: theme.textColor,
                  marginBottom: "8px"
                }}>
                  Start a conversation
                </div>
                <div style={{ 
                  fontSize: "14px", 
                  color: theme.textColor, 
                  opacity: 0.7,
                  marginBottom: "24px"
                }}>
                  Try asking a question or use voice input
                </div>
                <div style={{ 
                  display: "flex", 
                  gap: "10px", 
                  flexWrap: "wrap",
                  justifyContent: "center"
                }}>
                  {suggestedPrompts.map((prompt, index) => (
                    <div 
                      key={index}
                      className="suggestion-chip"
                      onClick={() => setUserMessage(prompt.text)}
                    >
                      {prompt.emoji} {prompt.text.split(' ').slice(0, 2).join(' ')}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {conversationHistory.map((msg, index) => (
              <div 
                key={index} 
                style={{ 
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}
              >
                {msg.role === "assistant" && (
                  <div style={{ 
                    fontSize: "11px", 
                    fontWeight: 500,
                    color: theme.textColor,
                    opacity: 0.5,
                    paddingLeft: "20px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em"
                  }}>
                    Loco
                  </div>
                )}
                <div className={`chat-message ${msg.role}`}>
                  {msg.role === "assistant" ? (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p style={{ margin: "0 0 12px 0", lineHeight: 1.7 }}>{children}</p>,
                        strong: ({ children }) => <strong style={{ fontWeight: 600, color: theme.accentColor }}>{children}</strong>,
                        em: ({ children }) => <em style={{ fontStyle: "italic", opacity: 0.9 }}>{children}</em>,
                        ul: ({ children }) => <ul style={{ margin: "12px 0", paddingLeft: "24px", lineHeight: 1.8 }}>{children}</ul>,
                        ol: ({ children }) => <ol style={{ margin: "12px 0", paddingLeft: "24px", lineHeight: 1.8 }}>{children}</ol>,
                        li: ({ children }) => <li style={{ marginBottom: "6px" }}>{children}</li>,
                        code: ({ node, className, children, ...props }: any) => {
                          const isInline = !className;
                          return isInline ? (
                            <code style={{ 
                              background: "rgba(255,255,255,0.1)", 
                              padding: "3px 8px", 
                              borderRadius: "5px", 
                              fontFamily: "'SF Mono', 'Monaco', monospace", 
                              fontSize: "13px",
                              color: theme.accentColor,
                              fontWeight: 500
                            }}>{children}</code>
                          ) : null;
                        },
                        a: ({ href, children }) => (
                          <a 
                            href={href} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ 
                              color: theme.accentColor, 
                              textDecoration: "none",
                              borderBottom: `1px solid ${theme.accentColor}40`,
                              transition: "all 0.2s ease"
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderBottomColor = theme.accentColor}
                            onMouseLeave={(e) => e.currentTarget.style.borderBottomColor = `${theme.accentColor}40`}
                          >
                            {children}
                          </a>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote style={{ 
                            borderLeft: `3px solid ${theme.accentColor}`, 
                            paddingLeft: "16px", 
                            margin: "12px 0", 
                            opacity: 0.9,
                            fontStyle: "italic"
                          }}>
                            {children}
                          </blockquote>
                        ),
                        h1: ({ children }) => <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "16px 0 10px 0", color: theme.accentColor }}>{children}</h1>,
                        h2: ({ children }) => <h2 style={{ fontSize: "19px", fontWeight: 600, margin: "14px 0 8px 0" }}>{children}</h2>,
                        h3: ({ children }) => <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "12px 0 6px 0" }}>{children}</h3>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "12px",
                padding: "16px 20px",
                background: "rgba(6,10,30,0.6)",
                borderRadius: "18px",
                border: `1px solid ${theme.borderColor}40`,
                alignSelf: "flex-start",
                maxWidth: "200px"
              }}>
                <div style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: theme.accentColor,
                  animation: "pulse 1.5s ease-in-out infinite"
                }} />
                <span style={{ 
                  fontSize: "14px", 
                  color: theme.textColor,
                  opacity: 0.8
                }}>
                  Thinking...
                </span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Terminal Panel */}
        {showTerminal && (
          <div className="terminal-panel" style={{ borderColor: theme.borderColor }}>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              marginBottom: "16px", 
              paddingBottom: "16px", 
              borderBottom: `1px solid ${theme.borderColor}40` 
            }}>
              <div>
                <span style={{ 
                  fontSize: "14px", 
                  fontWeight: 600, 
                  color: theme.textColor 
                }}>
                  {extractedCode && terminalCommands.length > 0 ? "Code & Terminal Commands" : extractedCode ? "Code" : "Terminal Commands"}
                </span>
                {codeLanguage && (
                  <span style={{
                    marginLeft: "10px",
                    fontSize: "11px",
                    padding: "3px 8px",
                    background: theme.accentColor + "30",
                    color: theme.accentColor,
                    borderRadius: "4px",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em"
                  }}>
                    {codeLanguage}
                  </span>
                )}
              </div>
              <button 
                onClick={() => setShowTerminal(false)} 
                style={{ 
                  background: "transparent", 
                  border: "none", 
                  color: theme.textColor, 
                  cursor: "pointer", 
                  fontSize: "20px", 
                  padding: "4px 8px", 
                  opacity: 0.6,
                  transition: "opacity 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "0.6"}
              >
                ✕
              </button>
            </div>
            
            <div className="terminal-content" style={{ color: theme.textColor }}>
              {extractedCode ? (
                <div style={{ marginBottom: "20px" }}>
                  <pre style={{ 
                    margin: 0, 
                    whiteSpace: "pre-wrap", 
                    wordBreak: "break-word", 
                    fontFamily: "'SF Mono', 'Monaco', monospace", 
                    fontSize: "13px", 
                    lineHeight: "1.7", 
                    background: "rgba(0,0,0,0.4)", 
                    padding: "16px", 
                    borderRadius: "8px", 
                    maxHeight: "350px", 
                    overflowY: "auto",
                    border: `1px solid ${theme.borderColor}20`
                  }}>
                    {extractedCode}
                  </pre>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(extractedCode);
                      setCopiedNotification(true);
                      setTimeout(() => setCopiedNotification(false), 2000);
                    }} 
                    className="btn btn-primary"
                    style={{ marginTop: "12px" }}
                  >
                    📋 Copy Code
                  </button>
                </div>
              ) : null}
              
              {terminalCommands.length > 0 && (
                <div>
                  <div style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: theme.accentColor,
                    marginBottom: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em"
                  }}>
                    Terminal Commands
                  </div>
                  {terminalCommands.map((cmd, i) => (
                    <div 
                      key={i} 
                      style={{ 
                        marginBottom: "10px", 
                        fontFamily: "'SF Mono', 'Monaco', monospace", 
                        fontSize: "13px", 
                        color: theme.textColor,
                        background: "rgba(0,0,0,0.3)",
                        padding: "10px 12px",
                        borderRadius: "6px",
                        borderLeft: `3px solid ${theme.accentColor}`
                      }}
                    >
                      <span style={{ color: theme.accentColor, opacity: 0.7 }}>$ </span>{cmd}
                    </div>
                  ))}
                </div>
              )}
              
              {!extractedCode && terminalCommands.length === 0 && (
                <div style={{ 
                  opacity: 0.6, 
                  fontSize: "13px", 
                  lineHeight: "1.7",
                  textAlign: "center",
                  padding: "40px 20px"
                }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}>📟</div>
                  <p style={{ fontWeight: 600, marginBottom: "12px" }}>No code blocks found</p>
                  <p style={{ fontSize: "12px", margin: "0", opacity: 0.8 }}>
                    Ask the AI to provide code wrapped in markdown code blocks
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div style={{ 
        padding: "20px 24px", 
        borderTop: `1px solid ${theme.borderColor}20`, 
        background: "rgba(6,10,30,0.98)", 
        backdropFilter: "blur(24px)" 
      }}>
        <div className="input-container">
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Ask me anything..." 
            value={userMessage} 
            onChange={(e) => setUserMessage(e.target.value)} 
            onKeyDown={(e) => { 
              if (e.key === "Enter" && !e.shiftKey) { 
                e.preventDefault(); 
                handleSendMessage(); 
              } 
            }} 
            disabled={loading} 
            style={{ 
              padding: "14px 18px", 
              border: `1px solid ${theme.borderColor}40`, 
              background: "rgba(255,255,255,0.05)", 
              color: theme.textColor, 
              borderRadius: "12px", 
              fontFamily: "inherit", 
              fontSize: "14px", 
              flex: 1, 
              outline: "none",
              transition: "all 0.2s ease"
            }} 
            onFocus={(e) => {
              e.target.style.borderColor = theme.accentColor + "60";
              e.target.style.background = "rgba(255,255,255,0.08)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = theme.borderColor + "40";
              e.target.style.background = "rgba(255,255,255,0.05)";
            }}
          />
          
          <button 
            onClick={handleSendMessage} 
            disabled={loading || !userMessage.trim()} 
            className="btn btn-primary"
            style={{
              minWidth: "100px"
            }}
          >
            {loading ? "●●●" : "Send →"}
          </button>
          
          {speechSupported && (
            <button 
              onClick={toggleListening} 
              disabled={loading} 
              className={`btn ${listening ? "btn-primary" : "btn-secondary"}`}
              style={{
                boxShadow: listening ? `0 0 20px ${theme.accentColor}80` : "none",
                minWidth: "50px"
              }}
            >
              {listening ? "🎤" : "🎤"}
            </button>
          )}
        </div>
      </div>

      <audio ref={audioRef} autoPlay controls style={{ display: "none" }} />
      
      {/* Notification Toast */}
      {copiedNotification && (
        <div style={{
          position: "fixed",
          bottom: "30px",
          right: "30px",
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          color: "#fff",
          padding: "16px 24px",
          borderRadius: "12px",
          boxShadow: "0 10px 40px rgba(16, 185, 129, 0.4), 0 0 1px rgba(255,255,255,0.2) inset",
          fontSize: "14px",
          fontWeight: 500,
          zIndex: 9999,
          animation: "slideInUp 0.3s ease-out",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          backdropFilter: "blur(10px)"
        }}>
          <span style={{ fontSize: "20px" }}>✓</span>
          <span>Code copied to clipboard!</span>
        </div>
      )}
    </div>
  );
}