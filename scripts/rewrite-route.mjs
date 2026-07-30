import fs from "node:fs";
import path from "node:path";

const root = path.resolve("c:/Projects/Loco-Test");
const routePath = path.join(root, "app/api/route.ts");
const lines = fs.readFileSync(routePath, "utf8").split(/\r?\n/);

// Keep RESOURCES object (lines 77-121) and POST from 1059 onward.
// Drop dead generateGameAutonomously and inlined helpers that moved to modules.

const resourcesBlock = lines.slice(76, 121).join("\n"); // RESOURCES = { ... };
const postBlock = lines.slice(1058).join("\n"); // export async function POST...

const header = `import { NextRequest, NextResponse } from "next/server";

// In plain terms: this is the server-side brain for the main chat feature.
// It receives user messages, pulls in memory and attachment context,
// routes the request through the app's workflow, and returns the final AI response.
import {
  formatCodeWithLineNumbers,
  buildCodeSummary,
  extractLineNumbersFromResponse,
  validateLineNumbers
} from "@/tools/hooks/utils/codeProcessor";
import {
  clearPendingDraft,
  formatDraftConfirmation,
  getLatestPendingDraft,
  isCalendarConfirmationReply,
  looksLikeCalendarClarificationFollowUp,
  looksLikeCalendarIntent,
  parseCalendarIntent,
  previousAssistantAskedCalendarClarification,
  previousAssistantAskedToConfirm,
  savePendingDraft,
} from "@/lib/calendarIntent";
import {
  buildPersistentMemoryContext,
  buildRelevantConversationContext,
  type RelevantConversationMatch,
  type RelevantConversationResult,
  listRememberedCalendarEvents,
} from "@/lib/chatMemory";
import {
  buildAssistantMemoryContext,
  buildRelevantAssistantMemoryContext,
  type RelevantAssistantMemoryMatch,
  type RelevantAssistantMemoryResult,
  extractMemoryContent,
  formatAssistantMemoryRecall,
  inferImplicitMemoryCandidate,
  isExplicitMemoryRequest,
  looksLikeMemoryRecallQuestion,
  rememberAssistantFact,
} from "@/lib/assistantMemory";
import {
  createCalendarEvent,
  deleteCalendarEvents,
  getStoredCalendarConnection,
  listCalendarEvents,
} from "@/lib/googleCalendar";
import {
  buildAttachmentPromptContext,
  type AttachmentContextItem,
} from "@/lib/attachmentContext";
import { looksLikePlanetTourRequest } from "@/lib/earthTour";
import { withOptionalPersistence } from "@/lib/orchestration/openaiTransport";
import { reviewLocoResponse } from "@/lib/orchestration/review";
import {
  formatEventSuccessMessage,
  formatLiveCalendarDeleteConfirmation,
  formatLiveCalendarEventsMessage,
  formatRememberedEventsMessage,
  fallbackCalendarTitleFromRequest,
  mergeCalendarClarificationReply,
  resolveCalendarDayRange,
} from "@/lib/orchestration/calendarHeuristics";
import {
  getUserMessageBeforeLatestAssistant,
  isCancellationReply,
  looksLikeCalendarCreateRequest,
  looksLikeCalendarMemoryQuestion,
  looksLikeCodeRequest,
  looksLikeGameRequest,
  looksLikeLiveCalendarDeleteRequest,
  looksLikeLiveCalendarReadRequest,
  looksLikeReplyDraftRequest,
  previousAssistantAskedLiveDeleteConfirmation,
} from "@/lib/orchestration/requestHeuristics";
import type { Message } from "@/lib/orchestration/types";
import { callClaudeChat, callOpenAIChat } from "@/lib/providers/chat";
import { synthesizeSpeech } from "@/lib/providers/tts";
import { resolveAssistantRouting } from "@/lib/assistant/routing";
import { loadGameExamples, formatGameExamplesForContext } from "@/lib/gameExamples";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const LIVE_CALENDAR_DELETE_MARKER = "Google Calendar delete confirmation ready.";

${resourcesBlock}
`;

let post = postBlock
  .replace(
    /previousAssistantAskedLiveDeleteConfirmation\(messages\)/g,
    "previousAssistantAskedLiveDeleteConfirmation(messages, LIVE_CALENDAR_DELETE_MARKER)"
  )
  .replace(
    /const \{\s*messages,\s*code,\s*attachments = \[\],\s*previewRuntimeIssue = null,\s*autoFixPreview = false,\s*language,\s*user,\s*topic = "general",\s*voice = "alloy",\s*timeZone = "UTC",\s*sessionId = null,\s*\} = await request\.json\(\);/s,
    `const {
      messages,
      code,
      attachments = [],
      previewRuntimeIssue = null,
      autoFixPreview = false,
      language,
      user,
      topic = "general",
      voice = "alloy",
      timeZone = "UTC",
      sessionId = null,
      assistantMode = "auto",
    } = await request.json();`
  );

// Replace generation provider selection with routing-aware version
post = post.replace(
  /\/\/ Use Claude for code\/game if available, otherwise OpenAI\n\s*const useClaudeForCodeGame = \(isCodeRequest \|\| isGameRequest\) && CLAUDE_API_KEY;\s*\n\s*let aiMessage: string;\s*\n\s*\/\/ For game\/code requests, use higher token limits to generate full featured games\n\s*const tokenConfig = isGameRequest \? \{ temperature: 0\.1, maxTokens: 8000 \} : \{ temperature: 0\.7, maxTokens: 1000 \};\s*\n\s*if \(useClaudeForCodeGame\) \{\s*try \{\s*aiMessage = await callClaudeChat\(apiMessages, tokenConfig\);\s*\} catch \(claudeError\) \{\s*\/\/ Silent fallback to OpenAI\s*aiMessage = await callOpenAIChat\(apiMessages, tokenConfig\);\s*\}\s*\} else \{\s*aiMessage = await callOpenAIChat\(apiMessages, tokenConfig\);\s*\}/s,
  `const routing = resolveAssistantRouting({
      assistantMode,
      latestUserMessage,
      isCodeRequest,
      isGameRequest,
      claudeAvailable: Boolean(CLAUDE_API_KEY),
    });

    let aiMessage: string;
    let routingFallbackReason: string | null = routing.fallbackReason ?? null;

    const tokenConfig = isGameRequest ? { temperature: 0.1, maxTokens: 8000 } : { temperature: 0.7, maxTokens: 1000 };
    const useClaude = routing.provider === "claude";

    if (useClaude) {
      try {
        aiMessage = await callClaudeChat(apiMessages, tokenConfig);
      } catch (claudeError) {
        aiMessage = await callOpenAIChat(apiMessages, tokenConfig);
        routingFallbackReason = "claude_error_fallback_openai";
      }
    } else {
      aiMessage = await callOpenAIChat(apiMessages, tokenConfig);
    }`
);

post = post.replace(/useClaudeForCodeGame/g, "useClaude");

// Replace TTS block with synthesizeSpeech
post = post.replace(
  /if \(voice && aiMessage && TTS_PROVIDER !== "browser"\) \{\s*try \{[\s\S]*?\} catch \(e\) \{\s*console\.error\("TTS error", e\);\s*\}\s*\}/,
  `const audioFromProvider = await synthesizeSpeech(aiMessage, voice);
    if (audioFromProvider) {
      audioBase64 = audioFromProvider;
    }`
);

// Add routing to response JSON
post = post.replace(
  /return NextResponse\.json\(\{\s*success: true,\s*message: aiMessage,\s*audio: audioBase64,\s*memoryHit,\s*memorySources,\s*memoryMatches,\s*pipeline: \{/,
  `return NextResponse.json({
      success: true,
      message: aiMessage,
      audio: audioBase64,
      memoryHit,
      memorySources,
      memoryMatches,
      routing: {
        requestedAssistantMode: routing.requestedAssistantMode,
        resolvedAssistantMode: routing.resolvedAssistantMode,
        provider: routingFallbackReason ? "openai" : routing.provider,
        fallbackReason: routingFallbackReason,
        analysisSource: routing.analysisSource,
        rationale: routing.rationale,
        confidence: routing.confidence,
      },
      pipeline: {`
);

fs.writeFileSync(routePath, `${header}\n${post}\n`);
console.log("Rewrote app/api/route.ts");
