"use client";

// In plain terms: this is the settings screen for Loco.
// It lets the user check integrations, change assistant and voice-related options,
// and manage app behavior without touching code.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FlaskConical,
  Link2,
  LogOut,
  Mic2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VOICE_THEMES, VoiceKey } from "@/tools/hooks/utils/themes";
import { useElectron } from "@/tools/hooks/useElectron";
import {
  parseStoredYouTubePlaylistAliases,
  YOUTUBE_PLAYLIST_STORAGE_KEY,
  type YouTubePlaylistAlias,
} from "@/lib/youtube";
import type { AssistantMode } from "@/tools/hooks/utils/apiClient";

type TtsProvider = "browser" | "server" | "piper";

interface BrowserVoiceStatus {
  selectedVoiceName: string | null;
  exactMatchAvailable: boolean;
  totalVoices: number;
}

interface CalendarStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  redirectUri?: string | null;
}

interface PiperStatus {
  available: boolean;
  reason?: string | null;
  executable?: string;
  model?: string;
}

interface YouTubeStatus {
  configured: boolean;
  oauthConfigured: boolean;
  storageReady?: boolean;
  connected: boolean;
  email?: string | null;
  channelTitle?: string | null;
  redirectUri?: string | null;
}

interface TabButtonProps {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface ToggleCardProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M21.8 12.23c0-.72-.06-1.25-.2-1.8H12v3.61h5.64c-.11.9-.73 2.25-2.11 3.16l-.02.12 3.01 2.28.21.02c1.94-1.75 3.07-4.31 3.07-7.39Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.76 0 5.08-.89 6.77-2.39l-3.22-2.42c-.86.59-2.02 1-3.55 1-2.7 0-4.99-1.75-5.81-4.17l-.12.01-3.13 2.37-.04.11A10.24 10.24 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.19 14.02A6.08 6.08 0 0 1 5.85 12c0-.7.12-1.38.33-2.02l-.01-.13L3.01 7.45l-.1.04A9.88 9.88 0 0 0 1.8 12c0 1.62.4 3.15 1.11 4.51l3.28-2.49Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.81c1.93 0 3.23.81 3.97 1.49l2.9-2.76C17.07 2.92 14.76 2 12 2a10.24 10.24 0 0 0-9.1 5.49l3.25 2.49C7.01 7.56 9.3 5.81 12 5.81Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function TabButton({ active, label, icon, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-all ${
        active
          ? "border-primary/50 bg-primary/15 text-foreground shadow-[0_0_30px_hsl(var(--primary)/0.15)]"
          : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/30 hover:bg-card/70 hover:text-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ToggleCard({ title, description, checked, onChange }: ToggleCardProps) {
  return (
    <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-border/70 bg-card/70 px-5 py-4 transition-all hover:border-primary/25 hover:bg-card/90">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </label>
  );
}

function selectPreferredBrowserVoice(voices: SpeechSynthesisVoice[]) {
  return (
    voices.find((voice) => /google uk english male/i.test(voice.name) || /google uk english male/i.test(voice.voiceURI)) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb") && /daniel|george|arthur|alfie/i.test(voice.name)) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb") && /david|natural|google/i.test(voice.name)) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb")) ||
    voices.find((voice) => /david|natural|google/i.test(voice.name)) ||
    (voices.length > 0 ? voices[0] : null)
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { isElectron, tts } = useElectron();
  const [voice, setVoice] = useState<VoiceKey>("echo");
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>("browser");
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("auto");
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const [enablePingPong, setEnablePingPong] = useState(true);
  const [enableChess, setEnableChess] = useState(true);
  const [experimentalAiWorkflowEnabled, setExperimentalAiWorkflowEnabled] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"voice" | "integrations" | "experimental">("voice");
  const [theme] = useState(VOICE_THEMES["echo"]);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>({
    configured: false,
    connected: false,
    email: null,
  });
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null);
  const [piperStatus, setPiperStatus] = useState<PiperStatus | null>(null);
  const [youTubeStatus, setYouTubeStatus] = useState<YouTubeStatus>({ configured: false, oauthConfigured: false, connected: false });
  const [youTubeAliases, setYouTubeAliases] = useState<YouTubePlaylistAlias[]>([]);
  const [youTubeAliasName, setYouTubeAliasName] = useState("");
  const [youTubeAliasUrl, setYouTubeAliasUrl] = useState("");
  const [youTubeMessage, setYouTubeMessage] = useState<string | null>(null);
  const [browserVoiceStatus, setBrowserVoiceStatus] = useState<BrowserVoiceStatus>({
    selectedVoiceName: null,
    exactMatchAvailable: false,
    totalVoices: 0,
  });

  const loadCalendarStatus = async () => {
    setCalendarLoading(true);
    try {
      const response = await fetch("/api/google-calendar", { cache: "no-store" });
      const data = await response.json();
      setCalendarStatus(data);
    } catch (error) {
      console.error("Failed to load Google Calendar status:", error);
      setCalendarMessage("Could not load Google Calendar status.");
    } finally {
      setCalendarLoading(false);
    }
  };

  const loadYouTubeStatus = async () => {
    try {
      const response = await fetch("/api/youtube", { cache: "no-store" });
      const rawBody = await response.text();
      const data = rawBody ? JSON.parse(rawBody) : {};

      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to load YouTube status.");
      }

      setYouTubeStatus({
        configured: Boolean(data?.configured),
        oauthConfigured: Boolean(data?.oauthConfigured),
        storageReady: data?.storageReady !== false,
        connected: Boolean(data?.connected),
        email: data?.email ?? null,
        channelTitle: data?.channelTitle ?? null,
        redirectUri: data?.redirectUri ?? null,
      });
    } catch (error) {
      console.error("Failed to load YouTube status:", error);
      setYouTubeStatus({ configured: false, oauthConfigured: false, storageReady: false, connected: false });
      setYouTubeMessage("Could not load YouTube status. If you just added the OAuth model, run your Prisma migration first.");
    }
  };

  useEffect(() => {
    const savedVoice = (localStorage.getItem("selectedVoice") as VoiceKey) || "echo";
    const savedTtsProvider = localStorage.getItem("selectedTtsProvider");
    const savedAssistantMode = localStorage.getItem("selectedAssistantMode");
    const savedAutoPlay = localStorage.getItem("autoPlayAudio") === "true";
    const savedPingPong = localStorage.getItem("enablePingPong") !== "false";
    const savedChess = localStorage.getItem("enableChess") !== "false";
    const savedExperimentalAiWorkflow = localStorage.getItem("experimentalAiWorkflow") === "true";

    setVoice(savedVoice);
    if (savedTtsProvider === "browser" || savedTtsProvider === "server" || savedTtsProvider === "piper") {
      setTtsProvider(savedTtsProvider);
    }
    if (savedAssistantMode === "auto" || savedAssistantMode === "loco" || savedAssistantMode === "claude") {
      setAssistantMode(savedAssistantMode);
    }
    setAutoPlayAudio(savedAutoPlay);
    setEnablePingPong(savedPingPong);
    setEnableChess(savedChess);
    setExperimentalAiWorkflowEnabled(savedExperimentalAiWorkflow);
    setYouTubeAliases(
      parseStoredYouTubePlaylistAliases(localStorage.getItem(YOUTUBE_PLAYLIST_STORAGE_KEY))
    );
    void loadCalendarStatus();
    void loadYouTubeStatus();
  }, []);

  useEffect(() => {
    if (!isElectron) {
      setPiperStatus(null);
      return;
    }

    let active = true;

    void tts.status(voice)
      .then((status) => {
        if (active) {
          setPiperStatus(status);
        }
      })
      .catch((error) => {
        console.error("Failed to load Piper status:", error);
        if (active) {
          setPiperStatus({ available: false, reason: "Unable to read Piper configuration." });
        }
      });

    return () => {
      active = false;
    };
  }, [isElectron, tts, voice]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }

    const updateBrowserVoiceStatus = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = selectPreferredBrowserVoice(voices);

      setBrowserVoiceStatus({
        selectedVoiceName: preferredVoice?.name || null,
        exactMatchAvailable: voices.some(
          (voice) => /google uk english male/i.test(voice.name) || /google uk english male/i.test(voice.voiceURI)
        ),
        totalVoices: voices.length,
      });
    };

    updateBrowserVoiceStatus();
    window.speechSynthesis.addEventListener("voiceschanged", updateBrowserVoiceStatus);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", updateBrowserVoiceStatus);
    };
  }, []);

  useEffect(() => {
    const googleCalendarParam = new URLSearchParams(window.location.search).get("googleCalendar");
    if (!googleCalendarParam) return;

    const messageMap: Record<string, string> = {
      connected: "Google Calendar connected successfully.",
      error: "Google Calendar connection failed.",
      "invalid-state": "Google Calendar sign-in could not be verified. Try again.",
    };

    setCalendarMessage(messageMap[googleCalendarParam] || null);
    setSettingsTab("integrations");
    void loadCalendarStatus();
  }, []);

  useEffect(() => {
    const youTubeParam = new URLSearchParams(window.location.search).get("youtube");
    if (!youTubeParam) return;

    const messageMap: Record<string, string> = {
      connected: "YouTube connected successfully.",
      error: "YouTube connection failed.",
      "invalid-state": "YouTube sign-in could not be verified. Try again.",
    };

    setYouTubeMessage(messageMap[youTubeParam] || null);
    setSettingsTab("integrations");
    void loadYouTubeStatus();
  }, []);

  const handleVoiceChange = (newVoice: VoiceKey) => {
    setVoice(newVoice);
    localStorage.setItem("selectedVoice", newVoice);
  };

  const handleTtsProviderChange = (provider: TtsProvider) => {
    setTtsProvider(provider);
    localStorage.setItem("selectedTtsProvider", provider);
  };

  const handleAssistantModeChange = (mode: AssistantMode) => {
    setAssistantMode(mode);
    localStorage.setItem("selectedAssistantMode", mode);
  };

  const handleAutoPlayChange = (checked: boolean) => {
    setAutoPlayAudio(checked);
    localStorage.setItem("autoPlayAudio", checked.toString());
  };

  const handlePingPongChange = (checked: boolean) => {
    setEnablePingPong(checked);
    localStorage.setItem("enablePingPong", checked.toString());
  };

  const handleChessChange = (checked: boolean) => {
    setEnableChess(checked);
    localStorage.setItem("enableChess", checked.toString());
  };

  const handleExperimentalAiWorkflowChange = (checked: boolean) => {
    setExperimentalAiWorkflowEnabled(checked);
    localStorage.setItem("experimentalAiWorkflow", checked.toString());
  };

  const handleConnectCalendar = () => {
    window.location.href = "/api/google-calendar/connect";
  };

  const handleDisconnectCalendar = async () => {
    setCalendarLoading(true);
    setCalendarMessage(null);
    try {
      const response = await fetch("/api/google-calendar", { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Disconnect failed");
      }
      setCalendarMessage("Google Calendar disconnected.");
      await loadCalendarStatus();
    } catch (error) {
      console.error("Failed to disconnect Google Calendar:", error);
      setCalendarMessage("Could not disconnect Google Calendar.");
      setCalendarLoading(false);
    }
  };

  const handleConnectYouTube = () => {
    window.location.href = "/api/youtube/connect";
  };

  const handleDisconnectYouTube = async () => {
    setYouTubeMessage(null);
    try {
      const response = await fetch("/api/youtube", { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Disconnect failed");
      }

      setYouTubeMessage("YouTube disconnected.");
      await loadYouTubeStatus();
    } catch (error) {
      console.error("Failed to disconnect YouTube:", error);
      setYouTubeMessage("Could not disconnect YouTube.");
    }
  };

  const saveYouTubeAliases = (nextAliases: YouTubePlaylistAlias[]) => {
    setYouTubeAliases(nextAliases);
    localStorage.setItem(YOUTUBE_PLAYLIST_STORAGE_KEY, JSON.stringify(nextAliases));
  };

  const handleAddYouTubeAlias = () => {
    const trimmedName = youTubeAliasName.trim();
    const trimmedUrl = youTubeAliasUrl.trim();

    if (!trimmedName || !trimmedUrl) {
      setYouTubeMessage("Enter both a playlist name and a YouTube playlist URL.");
      return;
    }

    if (!/^https?:\/\//i.test(trimmedUrl) || !/(youtube\.com|youtu\.be)/i.test(trimmedUrl) || !/[?&]list=/.test(trimmedUrl)) {
      setYouTubeMessage("Use a valid public YouTube playlist URL.");
      return;
    }

    const nextAliases = [
      ...youTubeAliases.filter((alias) => alias.name.toLowerCase() !== trimmedName.toLowerCase()),
      {
        id: `${trimmedName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
        name: trimmedName,
        url: trimmedUrl,
      },
    ];

    saveYouTubeAliases(nextAliases);
    setYouTubeAliasName("");
    setYouTubeAliasUrl("");
    setYouTubeMessage(`Saved "${trimmedName}". You can now say: play my ${trimmedName} playlist.`);
  };

  const handleDeleteYouTubeAlias = (aliasId: string) => {
    const nextAliases = youTubeAliases.filter((alias) => alias.id !== aliasId);
    saveYouTubeAliases(nextAliases);
  };

  const voiceDescriptions: Record<VoiceKey, string> = {
    alloy: "Balanced and clean for everyday coding help.",
    echo: "A sharper, more futuristic delivery for deeper sessions.",
    fable: "A warmer tone for conversational walkthroughs.",
  };
  const assistantModeLabels: Record<AssistantMode, string> = {
    auto: "Auto",
    claude: "Loco Code",
    loco: "Loco",
  };

  return (
    <div
      className="min-h-screen overflow-hidden bg-background text-foreground"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(99, 102, 241, 0.16), transparent 28%), radial-gradient(circle at top right, rgba(14, 165, 233, 0.12), transparent 24%), linear-gradient(180deg, #050816 0%, #0b1220 100%)",
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-[28px] border border-border/60 bg-card/70 px-6 py-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Loco Control Center
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Tune Loco&apos;s voice, control experimental behavior, and connect your Google account so calendar requests can move from chat into real events.
                </p>
              </div>
            </div>

            <Button variant="surface" onClick={() => router.back()} className="gap-2 self-start rounded-full px-4">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </header>

        <main className="mt-6 grid flex-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-[28px] border border-border/60 bg-card/65 p-4 backdrop-blur-xl">
            <div className="mb-4 px-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Sections</p>
            </div>
            <div className="flex flex-row flex-wrap gap-2 lg:flex-col">
              <TabButton
                active={settingsTab === "voice"}
                label="Voice"
                icon={<Mic2 className="h-4 w-4" />}
                onClick={() => setSettingsTab("voice")}
              />
              <TabButton
                active={settingsTab === "integrations"}
                label="Integrations"
                icon={<Link2 className="h-4 w-4" />}
                onClick={() => setSettingsTab("integrations")}
              />
              <TabButton
                active={settingsTab === "experimental"}
                label="Experimental"
                icon={<FlaskConical className="h-4 w-4" />}
                onClick={() => setSettingsTab("experimental")}
              />
            </div>
          </aside>

          <section className="rounded-[28px] border border-border/60 bg-card/65 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.35)] backdrop-blur-xl sm:p-8">
            {settingsTab === "voice" && (
              <div className="space-y-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Voice Profile</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Choose how Loco sounds</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Pick the voice personality that should be used when Loco speaks replies. Your selection is saved locally and reused the next time the app opens.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {(["alloy", "echo", "fable"] as VoiceKey[]).map((currentVoice) => {
                    const selected = voice === currentVoice;
                    return (
                      <button
                        key={currentVoice}
                        type="button"
                        onClick={() => handleVoiceChange(currentVoice)}
                        className={`rounded-[24px] border px-5 py-5 text-left transition-all ${
                          selected
                            ? "border-primary/50 bg-primary/12 shadow-[0_0_40px_hsl(var(--primary)/0.15)]"
                            : "border-border/70 bg-background/35 hover:border-primary/25 hover:bg-background/55"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-lg font-semibold capitalize text-foreground">{currentVoice}</span>
                          {selected && <CheckCircle2 className="h-5 w-5 text-primary" />}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">{voiceDescriptions[currentVoice]}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Assistant Routing</p>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight">Choose who handles code vs explanation</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Auto now runs a routing pass first: OpenAI classifies the user prompt, then code-heavy requests are sent through the code engine while explanation-first requests stay with Loco. The code engine needs an <span className="font-medium text-foreground">ANTHROPIC_API_KEY</span> on the server to be available in full.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {([
                      {
                        id: "auto",
                        title: "Auto",
                        description: "Use OpenAI to classify the prompt first, then route code work to the code engine and explanation work to Loco.",
                      },
                      {
                        id: "claude",
                        title: "Loco Code",
                        description: "Prefer the code engine for direct coding help, debugging, and implementation work.",
                      },
                      {
                        id: "loco",
                        title: "Loco",
                        description: "Keep Loco in charge for explanation-first replies and teaching tone.",
                      },
                    ] as Array<{ id: AssistantMode; title: string; description: string }>).map((option) => {
                      const selected = assistantMode === option.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleAssistantModeChange(option.id)}
                          className={`rounded-[24px] border px-5 py-5 text-left transition-all ${
                            selected
                              ? "border-primary/50 bg-primary/12 shadow-[0_0_40px_hsl(var(--primary)/0.15)]"
                              : "border-border/70 bg-background/35 hover:border-primary/25 hover:bg-background/55"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-lg font-semibold text-foreground">{option.title}</span>
                            {selected && <CheckCircle2 className="h-5 w-5 text-primary" />}
                          </div>
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">{option.description}</p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/35 px-5 py-4">
                    <p className="text-sm font-semibold text-foreground">Current assistant routing</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Active mode: <span className="font-medium text-foreground">{assistantModeLabels[assistantMode]}</span>
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Auto mode now uses a routing pipeline: OpenAI analyzes the latest prompt and available code context first, then the code engine receives implementation work while Loco keeps conceptual explanation requests.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Speech Engine</p>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight">Choose how replies are spoken</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Browser uses built-in speech synthesis, server uses the API response audio, and Piper uses the local Electron voice when it is configured on this machine.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {([
                      {
                        id: "browser",
                        title: "Browser",
                        description: "Uses the operating system voice already available in the browser runtime.",
                      },
                      {
                        id: "server",
                        title: "Server",
                        description: "Uses audio returned from the chat API when server-side TTS is enabled.",
                      },
                      {
                        id: "piper",
                        title: "Piper",
                        description: isElectron
                          ? piperStatus?.available
                            ? "Uses the local Piper CLI through Electron for offline desktop playback."
                            : `Electron desktop voice. ${piperStatus?.reason || "Piper is not configured yet."}`
                          : "Available in the Electron app when Piper is installed and configured.",
                      },
                    ] as Array<{ id: TtsProvider; title: string; description: string }>).map((option) => {
                      const selected = ttsProvider === option.id;
                      const disabled = option.id === "piper" && isElectron && piperStatus?.available === false;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleTtsProviderChange(option.id)}
                          disabled={disabled}
                          className={`rounded-[24px] border px-5 py-5 text-left transition-all ${
                            selected
                              ? "border-primary/50 bg-primary/12 shadow-[0_0_40px_hsl(var(--primary)/0.15)]"
                              : "border-border/70 bg-background/35 hover:border-primary/25 hover:bg-background/55"
                          } ${disabled ? "cursor-not-allowed opacity-60 hover:border-border/70 hover:bg-background/35" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-lg font-semibold text-foreground">{option.title}</span>
                            {selected && <CheckCircle2 className="h-5 w-5 text-primary" />}
                          </div>
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">{option.description}</p>
                        </button>
                      );
                    })}
                  </div>

                  {isElectron && (
                    <div className="rounded-2xl border border-border/70 bg-background/35 px-5 py-4">
                      <p className="text-sm font-semibold text-foreground">Piper desktop status</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {piperStatus?.available
                          ? `Configured and ready${piperStatus.model ? ` with model ${piperStatus.model}` : ""}.`
                          : piperStatus?.reason || "Checking Piper configuration..."}
                      </p>
                    </div>
                  )}

                  <div className="rounded-2xl border border-border/70 bg-background/35 px-5 py-4">
                    <p className="text-sm font-semibold text-foreground">Current speech routing</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Active engine: <span className="font-medium text-foreground">{ttsProvider}</span>
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Browser voice selected: <span className="font-medium text-foreground">{browserVoiceStatus.selectedVoiceName || "No browser voice detected yet"}</span>
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {browserVoiceStatus.exactMatchAvailable
                        ? "Google UK English Male is available in this browser."
                        : browserVoiceStatus.totalVoices > 0
                          ? "Google UK English Male is not installed here, so Loco is falling back to another available British voice."
                          : "No browser voices have been reported yet by speech synthesis."}
                    </p>
                    {ttsProvider !== "browser" && (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Browser voice preferences do not affect playback while the engine is set to {ttsProvider}.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/10 px-5 py-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    The selected voice profile controls tone, while the speech engine decides where playback comes from. Browser is the safest fallback, server depends on API audio being enabled, and Piper gives you local desktop playback when configured.
                  </p>
                </div>
              </div>
            )}

            {settingsTab === "integrations" && (
              <div className="space-y-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Google Calendar</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Sign in and connect your calendar</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Loco uses Google OAuth so you can sign in with your Google account and let the assistant draft events, ask for approval, and then write them into your calendar.
                  </p>
                </div>

                {calendarMessage && (
                  <div className="rounded-2xl border border-primary/25 bg-primary/10 px-5 py-4 text-sm leading-6 text-foreground">
                    {calendarMessage}
                  </div>
                )}

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                  <div className="rounded-[24px] border border-border/70 bg-background/35 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Account Access
                        </div>
                        <h3 className="mt-4 text-xl font-semibold">Sign in with Google</h3>
                        <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                          Connect once, then ask Loco to schedule lunches, meetings, reminders, or appointments directly from chat. Loco will always ask for confirmation before creating the event.
                        </p>
                      </div>
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary"
                        style={{ boxShadow: `0 0 40px ${theme.accentColor}22` }}
                      >
                        <ShieldCheck className="h-6 w-6" />
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Config</div>
                        <div className="mt-2 text-sm font-semibold text-foreground">
                          {calendarLoading ? "Checking" : calendarStatus.configured ? "Ready" : "Missing"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Connection</div>
                        <div className="mt-2 text-sm font-semibold text-foreground">
                          {calendarLoading ? "Loading" : calendarStatus.connected ? "Connected" : "Not connected"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Scope</div>
                        <div className="mt-2 text-sm font-semibold text-foreground">Calendar events</div>
                      </div>
                    </div>

                    {calendarStatus.email && (
                      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-sm">
                          <GoogleMark />
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">Connected account</div>
                          <div className="mt-1 font-semibold">{calendarStatus.email}</div>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button
                        onClick={handleConnectCalendar}
                        disabled={!calendarStatus.configured || calendarLoading}
                        className="rounded-full border border-white/15 bg-white text-slate-900 shadow-[0_18px_40px_rgba(255,255,255,0.14)] hover:bg-white/90 disabled:border-white/10 disabled:bg-white/70 disabled:text-slate-500"
                      >
                        <GoogleMark />
                        {calendarStatus.connected ? "Reconnect Google" : "Sign in with Google"}
                      </Button>

                      <Button
                        variant="surface"
                        onClick={handleDisconnectCalendar}
                        disabled={!calendarStatus.connected || calendarLoading}
                        className="rounded-full px-5"
                      >
                        <LogOut className="h-4 w-4" />
                        Disconnect
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-[24px] border border-border/70 bg-background/35 p-6">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">What happens next</div>
                      <div className="mt-4 space-y-4 text-sm leading-6 text-muted-foreground">
                        <div>
                          <div className="font-semibold text-foreground">1. Sign in</div>
                          <p>Use the Google button to authorize Loco against your own account.</p>
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">2. Ask naturally</div>
                          <p>Try something like “Schedule lunch with Sam tomorrow at 1 PM for 45 minutes.”</p>
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">3. Confirm</div>
                          <p>Loco drafts the event, shows the parsed details, and only creates it after you reply yes.</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-border/70 bg-background/35 p-6">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">OAuth Details</div>
                      <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                        <div>
                          <div className="font-semibold text-foreground">Redirect URI</div>
                          <p className="mt-1 break-all font-mono text-xs leading-5 text-muted-foreground">
                            {calendarStatus.redirectUri || "Not available"}
                          </p>
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">Environment</div>
                          <p className="mt-1">{calendarStatus.configured ? "OAuth variables detected in your environment." : "Google OAuth environment variables are still missing or invalid."}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                  <div className="rounded-[24px] border border-border/70 bg-background/35 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          <Link2 className="h-3.5 w-3.5" />
                          YouTube
                        </div>
                        <h3 className="mt-4 text-xl font-semibold">Signed-in playlists and personal YouTube playback</h3>
                        <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                          Public video searches still use the YouTube API. If you sign in with Google, Loco can also open your own playlists and personal library phrases like liked videos, watch later, or uploads.
                        </p>
                      </div>
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary"
                        style={{ boxShadow: `0 0 40px ${theme.accentColor}22` }}
                      >
                        <Mic2 className="h-6 w-6" />
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Public API</div>
                        <div className="mt-2 text-sm font-semibold text-foreground">{youTubeStatus.configured ? "Ready" : "Missing"}</div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">OAuth</div>
                        <div className="mt-2 text-sm font-semibold text-foreground">{youTubeStatus.oauthConfigured ? "Ready" : "Missing"}</div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Connection</div>
                        <div className="mt-2 text-sm font-semibold text-foreground">{youTubeStatus.connected ? "Connected" : "Not connected"}</div>
                      </div>
                    </div>

                    {youTubeStatus.email && (
                      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-sm">
                          <GoogleMark />
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">Connected YouTube account</div>
                          <div className="mt-1 font-semibold">{youTubeStatus.email}</div>
                          {youTubeStatus.channelTitle && <div className="mt-1 text-xs text-emerald-200/80">Channel: {youTubeStatus.channelTitle}</div>}
                        </div>
                      </div>
                    )}

                    {youTubeMessage && (
                      <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm leading-6 text-foreground">
                        {youTubeMessage}
                      </div>
                    )}

                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button
                        onClick={handleConnectYouTube}
                        disabled={!youTubeStatus.oauthConfigured}
                        className="rounded-full border border-white/15 bg-white text-slate-900 shadow-[0_18px_40px_rgba(255,255,255,0.14)] hover:bg-white/90 disabled:border-white/10 disabled:bg-white/70 disabled:text-slate-500"
                      >
                        <GoogleMark />
                        {youTubeStatus.connected ? "Reconnect YouTube" : "Sign in with Google"}
                      </Button>

                      <Button
                        variant="surface"
                        onClick={handleDisconnectYouTube}
                        disabled={!youTubeStatus.connected}
                        className="rounded-full px-5"
                      >
                        <LogOut className="h-4 w-4" />
                        Disconnect
                      </Button>
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
                      <input
                        value={youTubeAliasName}
                        onChange={(event) => setYouTubeAliasName(event.target.value)}
                        placeholder="boss"
                        className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
                      />
                      <input
                        value={youTubeAliasUrl}
                        onChange={(event) => setYouTubeAliasUrl(event.target.value)}
                        placeholder="https://www.youtube.com/playlist?list=..."
                        className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
                      />
                      <Button onClick={handleAddYouTubeAlias} className="rounded-2xl px-5">Save alias</Button>
                    </div>

                    <div className="mt-4 text-xs leading-5 text-muted-foreground">
                      Example: save alias <span className="font-semibold text-foreground">boss</span>, then say <span className="font-semibold text-foreground">play my boss playlist</span>.
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-[24px] border border-border/70 bg-background/35 p-6">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Command examples</div>
                      <div className="mt-4 space-y-4 text-sm leading-6 text-muted-foreground">
                        <div>
                          <div className="font-semibold text-foreground">Playlist alias</div>
                          <p>“Play my boss playlist.”</p>
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">Signed-in playlist</div>
                          <p>“Play my soundtrack playlist.”</p>
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">Newest upload</div>
                          <p>“Play the newest Bad Bunny video on YouTube.”</p>
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">YouTube search</div>
                          <p>“Play After Hours on YouTube.”</p>
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">Personal library</div>
                          <p>“Play my liked videos.” or “Play watch later.”</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-border/70 bg-background/35 p-6">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">YouTube OAuth Details</div>
                      <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                        <div>
                          <div className="font-semibold text-foreground">Redirect URI</div>
                          <p className="mt-1 break-all font-mono text-xs leading-5 text-muted-foreground">
                            {youTubeStatus.redirectUri || "Not available"}
                          </p>
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">Environment</div>
                          <p className="mt-1">{youTubeStatus.oauthConfigured ? "Google OAuth variables detected for YouTube sign-in." : "Google OAuth environment variables for YouTube are still missing or invalid."}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-border/70 bg-background/35 p-6">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Saved playlist aliases</div>
                      <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                        {youTubeAliases.length === 0 ? (
                          <p>No aliases saved yet.</p>
                        ) : (
                          youTubeAliases.map((alias) => (
                            <div key={alias.id} className="rounded-2xl border border-border/60 bg-card/70 px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-foreground">{alias.name}</div>
                                  <p className="mt-1 break-all text-xs leading-5 text-muted-foreground">{alias.url}</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteYouTubeAlias(alias.id)}>
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {settingsTab === "experimental" && (
              <div className="space-y-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Experimental</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Feature switches</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                    These features are still evolving. You can enable or disable them here without touching app code or local storage manually.
                  </p>
                </div>

                <div className="space-y-4">
                  <ToggleCard
                    title="Enable enhanced AI workflow"
                    description="Adds task classification, implementation brief rewriting, and richer review diagnostics before Loco returns code-oriented answers."
                    checked={experimentalAiWorkflowEnabled}
                    onChange={handleExperimentalAiWorkflowChange}
                  />
                  <ToggleCard
                    title="Auto-play TTS responses"
                    description="Automatically speak Loco responses after each assistant reply."
                    checked={autoPlayAudio}
                    onChange={handleAutoPlayChange}
                  />
                  <ToggleCard
                    title="Enable Ping Pong easter egg"
                    description="Type “ping pong” in chat to launch the hidden game route."
                    checked={enablePingPong}
                    onChange={handlePingPongChange}
                  />
                  <ToggleCard
                    title="Enable Chess game"
                    description="Type “chess” in chat to open the chess game route."
                    checked={enableChess}
                    onChange={handleChessChange}
                  />
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/10 px-5 py-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    Experimental features may change behavior between updates. They are safe to toggle, but you should expect iteration here before these controls become part of the stable product surface.
                  </p>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
