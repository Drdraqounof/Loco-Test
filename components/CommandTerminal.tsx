"use client";

// In plain terms: this component shows extracted commands and code in a terminal-style panel.

import { useEffect, useEffectEvent, useRef, useState } from "react";

interface TerminalCommand {
  id: string;
  input: string;
  output?: string;
  status: "pending" | "running" | "success" | "error";
  timestamp: number;
}

interface CommandTerminalProps {
  isOpen: boolean;
  onClose: () => void;
  commands: string[];
  theme: {
    borderColor: string;
    textColor: string;
    accentColor: string;
    buttonBg: string;
  };
  language?: string;
}

export default function CommandTerminal({
  isOpen,
  onClose,
  commands,
  theme,
  language = "bash",
}: CommandTerminalProps) {
  const [terminalCommands, setTerminalCommands] = useState<TerminalCommand[]>([]);
  const [executingIndex, setExecutingIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize commands when they change
  useEffect(() => {
    if (isOpen && commands.length > 0) {
      const newCommands = commands.map((cmd, idx) => ({
        id: `cmd-${Date.now()}-${idx}`,
        input: cmd,
        output: undefined,
        status: "pending" as const,
        timestamp: Date.now(),
      }));
      setTerminalCommands(newCommands);
    }
  }, [commands, isOpen]);

  // Auto-scroll to latest output

  const executeAllCommands = useEffectEvent(async () => {
    for (let i = 0; i < terminalCommands.length; i++) {
      const cmd = terminalCommands[i];

      setTerminalCommands((prev) => [
        ...prev.slice(0, i),
        { ...cmd, status: "running" },
        ...prev.slice(i + 1),
      ]);

      await new Promise((resolve) => setTimeout(resolve, 600));

      setTerminalCommands((prev) => [
        ...prev.slice(0, i),
        {
          ...cmd,
          status: "success",
          output: "Command executed successfully",
        },
        ...prev.slice(i + 1),
      ]);
    }
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [terminalCommands]);

  // Focus management
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to close
      if (e.key === "Escape") {
        onClose();
      }
      // Cmd/Ctrl + Enter to execute all
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        executeAllCommands();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop with blur */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(8px)",
          zIndex: 999,
          animation: "fadeIn 0.3s ease",
        }}
        onClick={onClose}
      />

      {/* Terminal Modal */}
      <div
        ref={containerRef}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "90%",
          maxWidth: "800px",
          height: "70vh",
          maxHeight: "600px",
          background: "rgba(6, 10, 30, 0.98)",
          border: `1px solid ${theme.borderColor}`,
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          zIndex: 1000,
          backdropFilter: "blur(20px)",
          boxShadow: `0 25px 50px rgba(0, 0, 0, 0.8), inset 0 1px 0 ${theme.borderColor}40`,
          animation: "slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Header with macOS-style controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: `1px solid ${theme.borderColor}33`,
            background: `linear-gradient(180deg, ${theme.borderColor}15 0%, transparent 100%)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Window controls */}
            <div style={{ display: "flex", gap: "6px" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "rgba(255, 100, 100, 0.7)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={onClose}
              />
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "rgba(255, 193, 7, 0.7)",
                  cursor: "pointer",
                }}
              />
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "rgba(76, 175, 80, 0.7)",
                  cursor: "pointer",
                }}
              />
            </div>
            <span
              style={{
                fontSize: "12px",
                fontFamily: "'Courier New', monospace",
                color: theme.textColor,
                marginLeft: "8px",
                opacity: 0.7,
              }}
            >
              loco@workspace — {language.toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: theme.textColor,
              fontSize: "20px",
              cursor: "pointer",
              opacity: 0.6,
              transition: "opacity 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "0.6";
            }}
          >
            ✕
          </button>
        </div>

        {/* Terminal Output */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            fontFamily: "'Courier New', monospace",
            fontSize: "13px",
            lineHeight: "1.6",
            color: theme.textColor,
            background: `radial-gradient(circle at 20% 50%, ${theme.accentColor}05 0%, transparent 50%)`,
            position: "relative",
          }}
        >
          {/* Terminal intro */}
          <div style={{ marginBottom: "16px", opacity: 0.6 }}>
            <div>
              <span style={{ color: theme.accentColor }}>loco@workspace</span>
              <span style={{ color: theme.textColor }}>:~$ </span>
              <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>
                Ready to execute commands
              </span>
            </div>
          </div>

          {/* Commands */}
          {terminalCommands.length > 0 ? (
            terminalCommands.map((cmd, idx) => (
              <div
                key={cmd.id}
                style={{
                  marginBottom: "12px",
                  animation: `slideIn 0.3s ease-out ${idx * 0.05}s both`,
                }}
              >
                {/* Command input line */}
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ color: theme.accentColor }}>loco@workspace</span>
                  <span style={{ color: theme.textColor }}>:~$ </span>
                  <span
                    style={{
                      color: theme.textColor,
                      fontWeight: 500,
                      letterSpacing: "0.5px",
                    }}
                  >
                    {cmd.input}
                  </span>
                  {cmd.status === "running" && (
                    <span
                      style={{
                        animation: "blink 1s infinite",
                        color: theme.accentColor,
                        marginLeft: "4px",
                      }}
                    >
                      ▋
                    </span>
                  )}
                </div>

                {/* Output */}
                {cmd.output && (
                  <div
                    style={{
                      marginTop: "4px",
                      paddingLeft: "0",
                      color:
                        cmd.status === "error"
                          ? "rgba(255, 100, 100, 0.8)"
                          : "rgba(100, 200, 100, 0.8)",
                      fontSize: "12px",
                      opacity: 0.8,
                    }}
                  >
                    {cmd.output}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div style={{ opacity: 0.5 }}>
              No commands to execute
            </div>
          )}
        </div>

        {/* Footer Input */}
        <div
          style={{
            borderTop: `1px solid ${theme.borderColor}33`,
            padding: "12px 16px",
            background: `linear-gradient(180deg, transparent 0%, ${theme.borderColor}10 100%)`,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ color: theme.accentColor, fontFamily: "'Courier New', monospace" }}>
            $
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type command or press Ctrl+Enter to execute all..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: theme.textColor,
              fontFamily: "'Courier New', monospace",
              fontSize: "13px",
              outline: "none",
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                executeAllCommands();
              }
            }}
          />
          <button
            onClick={executeAllCommands}
            style={{
              padding: "6px 14px",
              background: theme.buttonBg,
              color: theme.textColor,
              border: `1px solid ${theme.accentColor}`,
              borderRadius: "4px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "11px",
              fontWeight: 500,
              textTransform: "uppercase",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 12px ${theme.accentColor}44`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            Execute
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, -40%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0.3; }
        }

        div::-webkit-scrollbar {
          width: 6px;
        }

        div::-webkit-scrollbar-track {
          background: transparent;
        }

        div::-webkit-scrollbar-thumb {
          background: ${/* theme accent color injected via style */ 'rgba(100,180,255,0.2)'};
          border-radius: 3px;
        }

        div::-webkit-scrollbar-thumb:hover {
          background: rgba(100,180,255,0.35);
        }
      `}</style>
    </>
  );
}
