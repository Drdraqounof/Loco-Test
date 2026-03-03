"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { VOICE_THEMES, VoiceKey } from "@/utils/themes";

export default function SettingsPage() {
  const router = useRouter();
  const [voice, setVoice] = useState<VoiceKey>("echo");
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const [enablePingPong, setEnablePingPong] = useState(true);
  const [settingsTab, setSettingsTab] = useState<"voice" | "experimental">("voice");
  const [theme] = useState(VOICE_THEMES["echo"]);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedVoice = localStorage.getItem("selectedVoice") as VoiceKey || "echo";
    const savedAutoPlay = localStorage.getItem("autoPlayAudio") === "true";
    const savedPingPong = localStorage.getItem("enablePingPong") !== "false";

    setVoice(savedVoice);
    setAutoPlayAudio(savedAutoPlay);
    setEnablePingPong(savedPingPong);
  }, []);

  // Save settings to localStorage
  const handleVoiceChange = (newVoice: VoiceKey) => {
    setVoice(newVoice);
    localStorage.setItem("selectedVoice", newVoice);
  };

  const handleAutoPlayChange = (checked: boolean) => {
    setAutoPlayAudio(checked);
    localStorage.setItem("autoPlayAudio", checked.toString());
  };

  const handlePingPongChange = (checked: boolean) => {
    setEnablePingPong(checked);
    localStorage.setItem("enablePingPong", checked.toString());
  };

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "linear-gradient(135deg, #0a0e27 0%, #16213e 100%)",
      fontFamily: "'Inter', 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      color: theme.textColor,
    }}>
      {/* Header */}
      <div style={{
        padding: "24px",
        borderBottom: `1px solid ${theme.borderColor}20`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <h1 style={{
          margin: 0,
          fontSize: "24px",
          fontWeight: 700,
        }}>
          ⚙️ Settings
        </h1>
        <button
          onClick={() => router.back()}
          style={{
            background: `linear-gradient(135deg, ${theme.accentColor}40 0%, ${theme.accentColor}20 100%)`,
            border: `1px solid ${theme.accentColor}60`,
            color: theme.textColor,
            padding: "8px 16px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 600,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(135deg, ${theme.accentColor}60 0%, ${theme.accentColor}40 100%)`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(135deg, ${theme.accentColor}40 0%, ${theme.accentColor}20 100%)`;
          }}
        >
          ← Back
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: "auto",
        padding: "0",
      }}>
        {/* Tabs */}
        <div style={{
          borderBottom: `1px solid ${theme.borderColor}20`,
          padding: "12px 24px",
          display: "flex",
          gap: "8px",
          background: `${theme.borderColor}10`,
        }}>
          <button
            onClick={() => setSettingsTab("voice")}
            style={{
              background: settingsTab === "voice" ? `${theme.accentColor}30` : "transparent",
              border: `1px solid ${settingsTab === "voice" ? theme.accentColor : theme.borderColor}30`,
              color: theme.textColor,
              padding: "10px 20px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              transition: "all 0.2s ease",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            🎤 Voice
          </button>
          <button
            onClick={() => setSettingsTab("experimental")}
            style={{
              background: settingsTab === "experimental" ? `${theme.accentColor}30` : "transparent",
              border: `1px solid ${settingsTab === "experimental" ? theme.accentColor : theme.borderColor}30`,
              color: theme.textColor,
              padding: "10px 20px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              transition: "all 0.2s ease",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            🧪 Experimental
          </button>
        </div>

        {/* Voice Tab */}
        {settingsTab === "voice" && (
          <div style={{ padding: "40px 24px", maxWidth: "600px" }}>
            <h2 style={{
              fontSize: "18px",
              fontWeight: 600,
              marginBottom: "24px",
              marginTop: 0,
            }}>
              Voice Selection
            </h2>
            <p style={{
              fontSize: "14px",
              color: theme.textColor,
              opacity: 0.7,
              marginBottom: "24px",
              lineHeight: "1.6",
            }}>
              Choose your preferred voice for text-to-speech responses. The AI will respond using your selected voice.
            </p>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "12px",
              marginBottom: "32px",
            }}>
              {(["alloy", "echo", "fable"] as VoiceKey[]).map((v) => (
                <button
                  key={v}
                  onClick={() => handleVoiceChange(v)}
                  style={{
                    padding: "16px",
                    background: voice === v
                      ? `linear-gradient(135deg, ${theme.accentColor}40 0%, ${theme.accentColor}20 100%)`
                      : `${theme.borderColor}15`,
                    border: `2px solid ${voice === v ? theme.accentColor : theme.borderColor}30`,
                    color: theme.textColor,
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 600,
                    transition: "all 0.2s ease",
                    textAlign: "center",
                  }}
                  onMouseEnter={(e) => {
                    const btn = e.currentTarget as HTMLButtonElement;
                    if (voice !== v) {
                      btn.style.borderColor = `${theme.accentColor}60`;
                      btn.style.background = `${theme.borderColor}25`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    const btn = e.currentTarget as HTMLButtonElement;
                    if (voice !== v) {
                      btn.style.borderColor = `${theme.borderColor}30`;
                      btn.style.background = `${theme.borderColor}15`;
                    }
                  }}
                >
                  {voice === v && "✓ "}
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            <div style={{
              padding: "16px",
              background: `${theme.accentColor}15`,
              borderRadius: "8px",
              borderLeft: `4px solid ${theme.accentColor}`,
            }}>
              <p style={{
                fontSize: "13px",
                color: theme.textColor,
                margin: 0,
                opacity: 0.8,
              }}>
                💡 <strong>Pro Tip:</strong> Try different voices to find the one you prefer most
              </p>
            </div>
          </div>
        )}

        {/* Experimental Tab */}
        {settingsTab === "experimental" && (
          <div style={{ padding: "40px 24px", maxWidth: "600px" }}>
            <h2 style={{
              fontSize: "18px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: 0,
            }}>
              Experimental Features
            </h2>
            <p style={{
              fontSize: "13px",
              color: theme.textColor,
              opacity: 0.6,
              marginBottom: "32px",
              lineHeight: "1.6",
            }}>
              These features are still in development. Enable or disable them as needed.
            </p>

            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}>
              {/* Auto-play TTS */}
              <label style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                cursor: "pointer",
                padding: "16px",
                background: `${theme.borderColor}10`,
                borderRadius: "8px",
                border: `1px solid ${theme.borderColor}20`,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLLabelElement).style.background = `${theme.borderColor}20`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLLabelElement).style.background = `${theme.borderColor}10`;
              }}>
                <input
                  type="checkbox"
                  checked={autoPlayAudio}
                  onChange={(e) => handleAutoPlayChange(e.target.checked)}
                  style={{
                    width: "20px",
                    height: "20px",
                    cursor: "pointer",
                    accentColor: theme.accentColor,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}>
                    Auto-play TTS Responses
                  </div>
                  <div style={{
                    fontSize: "12px",
                    color: theme.textColor,
                    opacity: 0.6,
                  }}>
                    Automatically play voice responses when the AI replies
                  </div>
                </div>
              </label>

              {/* Ping Pong Easter Egg */}
              <label style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                cursor: "pointer",
                padding: "16px",
                background: `${theme.borderColor}10`,
                borderRadius: "8px",
                border: `1px solid ${theme.borderColor}20`,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLLabelElement).style.background = `${theme.borderColor}20`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLLabelElement).style.background = `${theme.borderColor}10`;
              }}>
                <input
                  type="checkbox"
                  checked={enablePingPong}
                  onChange={(e) => handlePingPongChange(e.target.checked)}
                  style={{
                    width: "20px",
                    height: "20px",
                    cursor: "pointer",
                    accentColor: theme.accentColor,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}>
                    Enable Ping Pong Easter Egg
                  </div>
                  <div style={{
                    fontSize: "12px",
                    color: theme.textColor,
                    opacity: 0.6,
                  }}>
                    Type "ping pong" in chat to play a game
                  </div>
                </div>
              </label>
            </div>

            <div style={{
              marginTop: "32px",
              padding: "16px",
              background: `${theme.accentColor}15`,
              borderRadius: "8px",
              borderLeft: `4px solid ${theme.accentColor}`,
            }}>
              <p style={{
                fontSize: "13px",
                color: theme.textColor,
                margin: 0,
                opacity: 0.8,
              }}>
                🧪 <strong>Note:</strong> These features may change or be removed in future updates
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
