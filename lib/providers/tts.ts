import { fetchOpenAI } from "@/lib/orchestration/openaiTransport";

// In plain terms: text-to-speech provider selection for server-side audio replies.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TTS_PROVIDER = process.env.TTS_PROVIDER || "openai";

export async function synthesizeSpeech(text: string, voice: string): Promise<string | null> {
  if (!voice || !text || TTS_PROVIDER === "browser") {
    return null;
  }

  try {
    if (TTS_PROVIDER === "gemini") {
      if (!GEMINI_API_KEY) {
        console.error("Gemini API key not configured for TTS");
        return null;
      }

      const voiceMap: Record<string, string> = {
        alloy: "en-US-Neural2-A",
        echo: "en-US-Neural2-C",
        fable: "en-US-Neural2-E",
      };
      const googleVoiceName = voiceMap[voice] || "en-US-Neural2-C";

      const ttsResponse = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { text },
            voice: { languageCode: "en-US", name: googleVoiceName },
            audioConfig: { audioEncoding: "MP3", pitch: 0, speakingRate: 1.0 },
          }),
        }
      );

      if (ttsResponse.ok) {
        const ttsData = await ttsResponse.json();
        if (ttsData.audioContent) {
          return ttsData.audioContent as string;
        }
        console.error("No audio content in response:", ttsData);
      } else {
        console.error("Google TTS error:", ttsResponse.status, await ttsResponse.text());
      }
      return null;
    }

    const ttsResponse = await fetchOpenAI("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text,
        voice,
        response_format: "mp3",
      }),
    });

    if (ttsResponse.ok) {
      const audioBuffer = await ttsResponse.arrayBuffer();
      return Buffer.from(audioBuffer).toString("base64");
    }

    console.error("OpenAI TTS API error:", ttsResponse.status, ttsResponse.statusText);
    return null;
  } catch (e) {
    console.error("TTS error", e);
    return null;
  }
}
