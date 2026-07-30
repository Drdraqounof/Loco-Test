// In plain terms: speech-to-text provider chain (OpenAI models, then Gemini fallback).

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const STT_MODELS = (process.env.OPENAI_STT_MODELS || process.env.OPENAI_STT_MODEL || "gpt-4o-mini-transcribe,gpt-4o-transcribe,whisper-1")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const GEMINI_STT_MODEL = process.env.GEMINI_STT_MODEL || "gemini-2.0-flash";

interface ProviderErrorPayload {
  error?: {
    message?: string;
    code?: string;
  };
}

interface GeminiGenerateContentResponse {
  error?: {
    message?: string;
  };
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface OpenAITranscriptionResponse {
  text?: string;
}

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  model?: string;
  error?: string;
  status?: number;
}

function buildTranscriptionFormData(audioFile: Blob, filename: string, model: string) {
  const transcriptionFormData = new FormData();
  transcriptionFormData.append("file", audioFile, filename);
  transcriptionFormData.append("model", model);
  return transcriptionFormData;
}

function canRetryWithAnotherModel(status: number, errorData: ProviderErrorPayload) {
  const errorMessage = String(errorData?.error?.message || "").toLowerCase();
  const errorCode = String(errorData?.error?.code || "").toLowerCase();

  return (
    status === 403 ||
    status === 404 ||
    errorCode === "model_not_found" ||
    errorMessage.includes("does not have access to model") ||
    errorMessage.includes("model_not_found")
  );
}

async function transcribeWithGemini(audioFile: Blob): Promise<TranscriptionResult | null> {
  if (!GEMINI_API_KEY) {
    return null;
  }

  const audioBuffer = Buffer.from(await audioFile.arrayBuffer()).toString("base64");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_STT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Transcribe this audio verbatim. Return only the spoken words without commentary, labels, or formatting.",
              },
              {
                inline_data: {
                  mime_type: audioFile.type || "audio/webm",
                  data: audioBuffer,
                },
              },
            ],
          },
        ],
      }),
    }
  );

  const data: GeminiGenerateContentResponse = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(`[STT] Gemini transcription error (${response.status}):`, JSON.stringify(data));
    return {
      success: false,
      status: response.status,
      error: data.error?.message || "Gemini transcription failed",
    };
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    return {
      success: false,
      status: 500,
      error: "Gemini returned no transcription text",
    };
  }

  return {
    success: true,
    text,
    model: GEMINI_STT_MODEL,
  };
}

export async function transcribeAudio(audioFile: Blob): Promise<TranscriptionResult> {
  if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
    return { success: false, status: 500, error: "No speech-to-text provider configured" };
  }

  if (audioFile.size === 0) {
    return {
      success: false,
      status: 400,
      error: "Audio recording was empty. Check microphone permissions.",
    };
  }

  const filename =
    typeof (audioFile as File).name === "string" && (audioFile as File).name
      ? (audioFile as File).name
      : audioFile.type.includes("ogg")
        ? "audio.ogg"
        : "audio.webm";

  let lastErrorMessage = "Transcription failed";
  let lastStatus = 500;

  if (OPENAI_API_KEY) {
    for (const model of STT_MODELS) {
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: buildTranscriptionFormData(audioFile, filename, model),
      });

      if (response.ok) {
        const data: OpenAITranscriptionResponse = await response.json();
        return {
          success: true,
          text: data.text,
          model,
        };
      }

      const errorData: ProviderErrorPayload = await response.json().catch(() => ({}));
      lastStatus = response.status;
      lastErrorMessage = errorData.error?.message || "Transcription failed";

      console.error(`[STT] OpenAI transcription error for model ${model} (${response.status}):`, JSON.stringify(errorData));

      if (!canRetryWithAnotherModel(response.status, errorData)) {
        return { success: false, status: response.status, error: lastErrorMessage };
      }

      console.warn(`[STT] Falling back to next transcription model after ${model} access failure`);
    }
  }

  const geminiResult = await transcribeWithGemini(audioFile);
  if (geminiResult?.success) {
    return geminiResult;
  }

  if (geminiResult && !geminiResult.success) {
    lastStatus = geminiResult.status ?? 500;
    lastErrorMessage = geminiResult.error || "Gemini transcription failed";
  }

  return {
    success: false,
    status: lastStatus,
    error: `${lastErrorMessage}. Tried models: ${STT_MODELS.join(", ")}`,
  };
}
