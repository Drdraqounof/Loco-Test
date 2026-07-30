import fs from "node:fs";
import path from "node:path";

const root = path.resolve("c:/Projects/Loco-Test");
const routePath = path.join(root, "app/api/route.ts");
const src = fs.readFileSync(routePath, "utf8");
const lines = src.split(/\r?\n/);

function slice(start1, end1Inclusive) {
  return lines.slice(start1 - 1, end1Inclusive).join("\n");
}

function exportify(block) {
  return block
    .replace(/^async function /gm, "export async function ")
    .replace(/^function /gm, "export function ");
}

for (const dir of [
  "lib/orchestration",
  "lib/providers",
  "lib/workforce",
  "lib/assistant",
]) {
  fs.mkdirSync(path.join(root, dir), { recursive: true });
}

fs.writeFileSync(
  path.join(root, "lib/orchestration/types.ts"),
  `// In plain terms: shared types for the chat orchestration pipeline.

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OpenAIChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: "json_object" };
}

export interface PipelineReviewResult {
  approved: boolean;
  matchesUserRequest: boolean;
  worksLikely: boolean;
  updatedUserQuery: string;
  reviewerNotes: string;
  fixes: string[];
}
`
);

fs.writeFileSync(
  path.join(root, "lib/orchestration/openaiTransport.ts"),
  `import { existsSync, readFileSync } from "node:fs";
import { Agent, type Dispatcher } from "undici";
import { isPersistenceUnavailableError } from "@/lib/persistence";

// In plain terms: OpenAI HTTP transport with optional local TLS workarounds, plus persistence helpers.

const OPENAI_CA_CERT_PATH = process.env.OPENAI_CA_CERT_PATH;
const OPENAI_ALLOW_INSECURE_TLS = process.env.OPENAI_ALLOW_INSECURE_TLS === "true";

let openAIDispatcher: Dispatcher | null | undefined;
let openAIInsecureFallbackDispatcher: Dispatcher | undefined;

${exportify(slice(147, 287))}
`
);

fs.writeFileSync(
  path.join(root, "lib/providers/chat.ts"),
  `import { fetchOpenAI, normalizeModelOutput } from "@/lib/orchestration/openaiTransport";
import type { Message, OpenAIChatOptions } from "@/lib/orchestration/types";

// In plain terms: chat provider adapters for OpenAI and Claude used by the main orchestrator.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

${exportify(slice(289, 373))}
`
);

fs.writeFileSync(
  path.join(root, "lib/orchestration/review.ts"),
  `import { callOpenAIChat } from "@/lib/providers/chat";
import type { Message, PipelineReviewResult } from "@/lib/orchestration/types";

// In plain terms: internal QA review pass for Loco draft answers.

${exportify(slice(457, 543))}
`
);

fs.writeFileSync(
  path.join(root, "lib/orchestration/requestHeuristics.ts"),
  `// In plain terms: lightweight text heuristics that classify chat requests before model generation.

${exportify(slice(565, 567))}

${exportify(slice(569, 580))}

${exportify(slice(582, 586))}

${exportify(slice(641, 722))}
`
);

fs.writeFileSync(
  path.join(root, "lib/orchestration/calendarHeuristics.ts"),
  `import { isTimeOnlyCalendarReply, normalizeWhitespace } from "@/lib/orchestration/requestHeuristics";

// In plain terms: calendar-specific formatting and day-range resolution for live calendar intents.

${exportify(slice(545, 563))}

${exportify(slice(588, 639))}

${exportify(slice(796, 1057))}
`
);

fs.writeFileSync(
  path.join(root, "lib/providers/tts.ts"),
  `import { fetchOpenAI } from "@/lib/orchestration/openaiTransport";

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
        \`https://texttospeech.googleapis.com/v1/text:synthesize?key=\${GEMINI_API_KEY}\`,
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
        Authorization: \`Bearer \${OPENAI_API_KEY}\`,
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
`
);

console.log("Extracted orchestration modules");
