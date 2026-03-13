# Web Speech Recognition API Documentation

> **Last Updated:** March 8, 2026 at 11:35 PM

## Overview
The Web Speech API enables voice control in your browser. This documentation covers implementation, usage, and best practices.

---

## Browser Support
- ✅ Chrome/Edge (Full support)
- ✅ Firefox (Partial support)
- ✅ Safari (Partial support)
- ❌ Internet Explorer (Not supported)

Use the `webkit` prefix fallback for compatibility.

---

## Basic Setup

### Hook: `useSpeechRecognition.ts`

```typescript
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

    // When recognition starts
    recognition.onstart = () => {
      isRecognitionRunningRef.current = true;
      transcriptRef.current = "";
    };

    // When speech is detected
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

    // When recognition ends
    recognition.onend = () => {
      isRecognitionRunningRef.current = false;
      if (transcriptRef.current.trim()) {
        setUserMessage(transcriptRef.current.trim());
      }
      setListening(false);
      
      if (!speechErrorRef.current) {
        setLabel("tap to speak");
      }
    };

    // Handle errors
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
```

---

## Usage in Components

### Simple Button Example
```typescript
'use client';

import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

export default function VoiceInput() {
  const {
    listening,
    label,
    speechError,
    userMessage,
    toggleListening,
    resetMessage,
  } = useSpeechRecognition({ lang: 'en-US' });

  return (
    <div className="space-y-4">
      <button
        onClick={toggleListening}
        className={`px-4 py-2 rounded ${
          listening
            ? 'bg-red-500 text-white'
            : 'bg-blue-500 text-white'
        }`}
      >
        🎤 {label}
      </button>

      {userMessage && (
        <div className="bg-gray-100 p-4 rounded">
          <p className="text-gray-700">{userMessage}</p>
          <button
            onClick={resetMessage}
            className="mt-2 text-sm text-blue-600"
          >
            Clear
          </button>
        </div>
      )}

      {speechError && (
        <div className="text-red-600 text-sm">
          Error: {speechError}
        </div>
      )}
    </div>
  );
}
```

### With Form Integration
```typescript
'use client';

import { useState } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

export default function VoiceForm() {
  const { listening, label, userMessage, toggleListening, resetMessage } = 
    useSpeechRecognition();
  const [formInput, setFormInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitted:', formInput);
    setFormInput('');
    resetMessage();
  };

  const insertvoice = () => {
    setFormInput(userMessage);
    resetMessage();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        value={formInput}
        onChange={(e) => setFormInput(e.target.value)}
        className="w-full p-2 border rounded"
        placeholder="Type or speak..."
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={toggleListening}
          className={`px-4 py-2 rounded text-white ${
            listening ? 'bg-red-500' : 'bg-blue-500'
          }`}
        >
          🎤 {label}
        </button>

        {userMessage && (
          <button
            type="button"
            onClick={insertvoice}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Insert
          </button>
        )}

        <button type="submit" className="px-4 py-2 bg-purple-500 text-white rounded">
          Submit
        </button>
      </div>
    </form>
  );
}
```

---

## Configuration Options

### Language Codes
```typescript
// Common languages
'en-US'    // English (US)
'en-GB'    // English (UK)
'es-ES'    // Spanish
'fr-FR'    // French
'de-DE'    // German
'ja-JP'    // Japanese
'zh-CN'    // Simplified Chinese
'zh-TW'    // Traditional Chinese
```

### Recognition Settings
```typescript
const recognition = new SpeechRecognition();

// Settings
recognition.continuous = false;      // Stop after user pauses
recognition.interimResults = true;   // Show real-time results
recognition.maxAlternatives = 1;     // Number of alternatives
recognition.lang = 'en-US';          // Language
```

---

## Key Properties

### Return Object
```typescript
{
  listening: boolean,           // Currently listening?
  label: string,               // Status text for button
  speechError: string | null,  // Error type if any
  speechSupported: boolean,    // API available?
  userMessage: string,         // Transcribed text
  setUserMessage: function,    // Set transcript manually
  toggleListening: function,   // Start/stop listening
  resetMessage: function,      // Clear transcript
}
```

---

## Error Handling

### Common Errors
```typescript
'no-speech'              // No audio detected
'audio-capture'          // Microphone access denied
'network'                // Network connection issue
'not-allowed'            // Permission denied
'service-not-allowed'    // Speech service disabled
'bad-grammar'            // Couldn't parse speech
'aborted'                // User stopped recording
```

---

## Best Practices

1. **Check Support First**
   ```typescript
   if (!speechSupported) {
     return <div>Speech not supported in this browser</div>;
   }
   ```

2. **Handle Permissions**
   - Request microphone access upfront
   - Show clear error when denied

3. **User Feedback**
   - Show visual indicator when listening
   - Display real-time transcription
   - Clear error messages

4. **Graceful Degradation**
   - Provide text input alternative
   - Don't depend on speech alone

5. **Performance**
   - Use `interimResults` for real-time feedback
   - Batch updates to avoid excessive re-renders
   - Cancel ongoing requests when component unmounts

---

## Advanced: Custom Hook with Callbacks

```typescript
export function useSpeechWithCallbacks(
  onResult?: (text: string) => void,
  onError?: (error: string) => void
) {
  const speech = useSpeechRecognition();

  useEffect(() => {
    if (speech.userMessage && onResult) {
      onResult(speech.userMessage);
    }
  }, [speech.userMessage]);

  useEffect(() => {
    if (speech.speechError && onError) {
      onError(speech.speechError);
    }
  }, [speech.speechError]);

  return speech;
}
```

---

## Accessibility Considerations

- Use ARIA labels: `aria-label="Voice input button"`
- Provide text alternative always
- Show listening indicator clearly
- Support keyboard controls
- Announce errors to screen readers

---

## Resources

- [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [W3C Specification](https://www.w3.org/TR/speech-api/)
- [Can I Use](https://caniuse.com/#feat=speech-recognition)
