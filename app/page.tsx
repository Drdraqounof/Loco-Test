"use client";

import { useEffect, useRef, useState } from "react";
import CommandTerminal from "@/components/CommandTerminal";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { parseResponse } from "@/utils/messageParser";
import { VOICE_THEMES, VoiceKey } from "@/utils/themes";
import { callAIAPI } from "@/utils/apiClient";

export default function Home() {
  const [voice, setVoice] = useState<VoiceKey>("echo");
  const [loading, setLoading] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [extractedCode, setExtractedCode] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const [terminalCommands, setTerminalCommands] = useState<string[]>([]);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string }>>([]);
  
  const { listening, speechSupported, userMessage, setUserMessage, toggleListening } = useSpeechRecognition();
  const { audioRef, playAudio } = useAudioPlayer();
  const theme = VOICE_THEMES[voice];
  const prevListeningRef = useRef(listening);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistory, loading]);

  useEffect(() => {
    if (prevListeningRef.current && !listening && userMessage.trim() && !loading) {
      handleSendMessage();
    }
    prevListeningRef.current = listening;
  }, [listening, userMessage, loading]);

  const handleSendMessage = async () => {
    if (!userMessage.trim()) return;
    setLoading(true);
    
    try {
      const updatedHistory = [...conversationHistory, { role: "user", content: userMessage }];
      setConversationHistory(updatedHistory);

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
      
      if (result.data.audio) {
        await playAudio(result.data.audio);
      }
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setLoading(false);
      setUserMessage("");
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: theme.bgGradient, fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", transition: "background 0.8s ease" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
        .terminal-panel { background: rgba(6,10,30,0.95); border: 1px solid; border-radius: 12px; padding: 20px; height: 500px; width: 400px; display: flex; flex-direction: column; overflow: hidden; animation: slideInRight 0.4s ease; backdrop-filter: blur(18px); box-shadow: 0 12px 40px rgba(0,0,0,0.7); flex-shrink: 0; }
        .terminal-content { flex: 1; overflow-y: auto; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.6; padding: 12px; border-radius: 8px; background: rgba(0,0,0,0.3); }
        .input-container { display: flex; gap: 10px; width: 100%; }
      `}</style>

      <div style={{ padding: "20px", borderBottom: `1px solid ${theme.borderColor}33`, textAlign: "center" }}>
        <p style={{ fontSize: "13px", fontWeight: 300, color: theme.accentColor, letterSpacing: "0.3em", textTransform: "uppercase", margin: 0 }}>AI Assistant - Echo Voice</p>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden", gap: "20px", padding: "20px" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", paddingRight: "10px" }}>
            {conversationHistory.length === 0 && !loading && (
              <div style={{ opacity: 0.5, fontSize: "14px", color: theme.textColor, textAlign: "center", margin: "auto" }}>
                Try asking a coding question or use voice input
              </div>
            )}

            {conversationHistory.map((msg, index) => (
              <div key={index} style={{ alignSelf: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "70%", padding: "14px 18px", borderRadius: "16px", background: msg.role === "user" ? theme.accentColor : "rgba(6,10,30,0.85)", color: msg.role === "user" ? "#000" : theme.textColor, border: msg.role === "user" ? "none" : `1px solid ${theme.borderColor}`, lineHeight: 1.6, fontSize: "14px", wordWrap: "break-word", whiteSpace: "pre-wrap" }}>
                {msg.content}
              </div>
            ))}

            {loading && <div style={{ opacity: 0.6, fontSize: "14px", color: theme.accentColor, animation: "pulse 1.5s ease-in-out infinite" }}>✨ AI is thinking...</div>}
            <div ref={chatEndRef} />
          </div>
        </div>

        {showTerminal && (
          <div className="terminal-panel" style={{ borderColor: theme.borderColor }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", paddingBottom: "12px", borderBottom: `1px solid ${theme.borderColor}` }}>
              <span style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: theme.accentColor }}>Code Output</span>
              <button onClick={() => setShowTerminal(false)} style={{ background: "transparent", border: "none", color: theme.textColor, cursor: "pointer", fontSize: "18px", padding: "4px 8px", opacity: 0.6 }}>✕</button>
            </div>
            <div className="terminal-content" style={{ color: theme.textColor }}>
              {extractedCode && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "10px", opacity: 0.6, marginBottom: "8px", textTransform: "uppercase" }}>{codeLanguage}</div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{extractedCode}</pre>
                </div>
              )}
              {terminalCommands.length > 0 && (
                <div>
                  <div style={{ fontSize: "10px", opacity: 0.6, marginBottom: "8px", textTransform: "uppercase" }}>Commands</div>
                  {terminalCommands.map((cmd, i) => (
                    <div key={i} style={{ marginBottom: "8px" }}><span style={{ color: theme.accentColor }}>$ </span>{cmd}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "20px", borderTop: `1px solid ${theme.borderColor}33`, background: "rgba(6,10,30,0.95)", backdropFilter: "blur(12px)" }}>
        <div className="input-container">
          <input type="text" placeholder="Ask me anything..." value={userMessage} onChange={(e) => setUserMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} disabled={loading} style={{ padding: "12px", border: `1px solid ${theme.borderColor}`, background: "rgba(6,10,30,0.7)", color: theme.textColor, borderRadius: "8px", fontFamily: "inherit", fontSize: "14px", flex: 1, outline: "none" }} />
          <button onClick={handleSendMessage} disabled={loading || !userMessage.trim()} style={{ padding: "10px 24px", background: theme.buttonBg, color: theme.textColor, border: `1px solid ${theme.borderColor}`, borderRadius: "8px", cursor: loading || !userMessage.trim() ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: 500, fontSize: "14px", opacity: loading || !userMessage.trim() ? 0.45 : 1 }}>{loading ? "Loading..." : "Send"}</button>
          {speechSupported && (
            <button onClick={toggleListening} disabled={loading} style={{ padding: "10px 20px", background: listening ? theme.accentColor : theme.buttonBg, color: listening ? "#000" : theme.textColor, border: `1px solid ${listening ? theme.accentColor : theme.borderColor}`, borderRadius: "8px", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: 500, fontSize: "14px", opacity: loading ? 0.45 : 1, boxShadow: listening ? `0 0 16px ${theme.accentColor}60` : "none" }}>{listening ? "🎤 Listening..." : "🎤"}</button>
          )}
        </div>
      </div>

      <audio ref={audioRef} />
    </div>
  );
}