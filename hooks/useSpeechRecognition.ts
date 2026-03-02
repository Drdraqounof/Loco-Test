import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
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

  useEffect(() => {
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
    recognition.continuous = false;
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
      const silentErrors = ["no-speech", "aborted"];
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
        if (["no-speech", "aborted"].includes(event.error)) {
          speechErrorRef.current = null;
          setLabel("tap to speak");
          setSpeechError(null);
        }
      }, 3000);
    };

    recognitionRef.current = recognition;
  }, [lang]);

  const startListening = () => {
    if (!speechSupported || !recognitionRef.current) return;

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
