import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
    electronAPI?: any;
  }
}

export interface UseSpeechRecognitionOptions {
  lang?: string;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { lang = "en-US" } = options;
  
  const [listening, setListening] = useState(false);
  const [label, setLabel] = useState("tap to speak");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  
  const recognitionRef = useRef<any>(null);
  const isRecognitionRunningRef = useRef(false);
  const transcriptRef = useRef<string>("");
  const speechErrorRef = useRef<string | null>(null);
  const [userMessage, setUserMessage] = useState("");

  // Electron: MediaRecorder-based recording for Whisper fallback
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // Derive at call time so it works reliably after hydration
  const isElectron = () => typeof window !== "undefined" && !!window.electronAPI;

  useEffect(() => {
    // In Electron the Web Speech API fails (missing Google API key in Chromium).
    // We use the MediaRecorder + Whisper path there, so skip Web Speech setup.
    if (isElectron()) {
      setSpeechSupported(true);
      return;
    }

    const SpeechRecognition =
      window.webkitSpeechRecognition || window.SpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech Recognition API not supported");
      setSpeechSupported(false);
      setLabel("speech not supported");
      return;
    }

    setSpeechSupported(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      isRecognitionRunningRef.current = true;
      transcriptRef.current = "";
    };

    recognition.onresult = (event: any) => {
      speechErrorRef.current = null;
      setSpeechError(null);

      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          transcriptRef.current += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      setUserMessage(transcriptRef.current + interim);
    };

    recognition.onend = () => {
      isRecognitionRunningRef.current = false;
      if (transcriptRef.current.trim()) {
        setUserMessage(transcriptRef.current.trim());
      }
      setListening(false);
      
      // Use ref to avoid stale state
      if (!speechErrorRef.current) {
        setLabel("tap to speak");
      }
    };

    recognition.onerror = (event: any) => {
      const silentErrors = ["no-speech", "aborted", "network"];
      if (!silentErrors.includes(event.error)) {
        console.error("Speech recognition error", event.error);
      }

      isRecognitionRunningRef.current = false;
      setListening(false);

      const errorMessages: { [key: string]: string } = {
        "no-speech": "no speech detected - try again",
        "audio-capture": "no microphone access",
        network: "no network connection",
        "not-allowed": "microphone permission denied",
        "service-not-allowed": "speech service disabled",
        "bad-grammar": "couldn't understand - try again",
        aborted: "recording stopped",
      };

      const message = errorMessages[event.error] || `error: ${event.error}`;
      speechErrorRef.current = event.error;
      setLabel(message);
      setSpeechError(event.error);

      setTimeout(() => {
        if (["no-speech", "aborted", "network"].includes(event.error)) {
          speechErrorRef.current = null;
          setLabel("tap to speak");
          setSpeechError(null);
        }
      }, 3000);
    };

    recognitionRef.current = recognition;
  }, [lang]);

  // --- Electron path: record via MediaRecorder then transcribe with Whisper ---
  const startElectronListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setLabel("processing...");

        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });

        if (audioBlob.size === 0) {
          console.error("[STT] Audio blob is empty — no audio was captured");
          setLabel("no audio captured - try again");
          setTimeout(() => setLabel("tap to speak"), 3000);
          isRecognitionRunningRef.current = false;
          setListening(false);
          return;
        }

        // Use the actual recorded MIME type for the filename extension
        const ext = (mediaRecorder.mimeType || "audio/webm").includes("ogg") ? "ogg" : "webm";
        const formData = new FormData();
        formData.append("file", audioBlob, `audio.${ext}`);

        try {
          const response = await fetch("/api/stt", { method: "POST", body: formData });
          const data = await response.json();
          if (data.success && data.text) {
            setUserMessage(data.text.trim());
          } else {
            console.warn("[STT] Transcription failed:", data.error);
            setLabel(typeof data.error === "string" ? data.error : "couldn't transcribe - try again");
            setTimeout(() => setLabel("tap to speak"), 3000);
          }
        } catch {
          setLabel("transcription failed - try again");
          setTimeout(() => setLabel("tap to speak"), 3000);
        } finally {
          isRecognitionRunningRef.current = false;
          setListening(false);
          if (!speechErrorRef.current) setLabel("tap to speak");
        }
      };

      mediaRecorder.start();
      isRecognitionRunningRef.current = true;
      setListening(true);
      setLabel("listening...");
    } catch (err) {
      console.error("Microphone access error:", err);
      setLabel("no microphone access");
      setSpeechError("audio-capture");
      setTimeout(() => {
        setLabel("tap to speak");
        setSpeechError(null);
      }, 3000);
    }
  };

  const stopElectronListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };
  // --------------------------------------------------------------------------

  const startListening = () => {
    if (!speechSupported) return;

    if (isElectron()) {
      startElectronListening();
      return;
    }

    if (!recognitionRef.current) return;

    speechErrorRef.current = null;
    setSpeechError(null);

    if (!isRecognitionRunningRef.current) {
      isRecognitionRunningRef.current = true;
      setLabel("listening...");
      setListening(true);
      try {
        recognitionRef.current.start();
      } catch (e) {
        isRecognitionRunningRef.current = false;
        console.error("Error starting recognition:", e);
        setLabel("error - try again");
      }
    }
  };

  const stopListening = () => {
    if (isElectron()) {
      stopElectronListening();
      return;
    }

    setLabel("processing...");
    if (isRecognitionRunningRef.current && recognitionRef.current) {
      recognitionRef.current.stop();
      isRecognitionRunningRef.current = false;
    }
  };

  const toggleListening = () => {
    if (!speechSupported) {
      setLabel("speech not supported");
      return;
    }

    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const resetMessage = () => {
    setUserMessage("");
    transcriptRef.current = "";
  };

  return {
    listening,
    label,
    speechError,
    speechSupported,
    userMessage,
    setUserMessage,
    toggleListening,
    resetMessage,
  };
}
