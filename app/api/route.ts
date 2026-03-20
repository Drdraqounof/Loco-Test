import { existsSync, readFileSync } from "node:fs";

import { NextRequest, NextResponse } from "next/server";
import { Agent, type Dispatcher } from "undici";

// In plain terms: this is the server-side brain for the main chat feature.
// It receives user messages, pulls in memory and attachment context,
// routes the request through the app's workflow, and returns the final AI response.
import {
  formatCodeWithLineNumbers,
  findElements,
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
import { isPersistenceUnavailableError } from "@/lib/persistence";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const AI_PROVIDER = process.env.AI_PROVIDER || "openai";
const TTS_PROVIDER = process.env.TTS_PROVIDER || "openai";
const LIVE_CALENDAR_DELETE_MARKER = "Google Calendar delete confirmation ready.";
const OPENAI_CA_CERT_PATH = process.env.OPENAI_CA_CERT_PATH;
const OPENAI_ALLOW_INSECURE_TLS = process.env.OPENAI_ALLOW_INSECURE_TLS === "true";

let openAIDispatcher: Dispatcher | null | undefined;

const RESOURCES = {
  javascript: [
    { title: "MDN JavaScript Guide", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide" },
    { title: "JavaScript.info", url: "https://javascript.info/" },
    { title: "FreeCodeCamp JavaScript Tutorial", url: "https://www.freecodecamp.org/learn/javascript/" },
    { title: "W3Schools JavaScript", url: "https://www.w3schools.com/js/" },
    { title: "Eloquent JavaScript Book", url: "https://eloquentjavascript.net/" },
  ],
  python: [
    { title: "Python Official Docs", url: "https://docs.python.org/3/" },
    { title: "Real Python Tutorials", url: "https://realpython.com/" },
    { title: "Python Tutorial for Beginners", url: "https://www.w3schools.com/python/" },
    { title: "Automate the Boring Stuff with Python", url: "https://automatetheboringstuff.com/" },
    { title: "Python.org Learning Resources", url: "https://www.python.org/about/gettingstarted/" },
  ],
  html: [
    { title: "MDN HTML Guide", url: "https://developer.mozilla.org/en-US/docs/Web/HTML" },
    { title: "W3Schools HTML", url: "https://www.w3schools.com/html/" },
    { title: "HTML5 Spec", url: "https://html.spec.whatwg.org/" },
    { title: "FreeCodeCamp HTML & CSS", url: "https://www.freecodecamp.org/learn/responsive-web-design/" },
  ],
  css: [
    { title: "MDN CSS Guide", url: "https://developer.mozilla.org/en-US/docs/Web/CSS" },
    { title: "CSS-Tricks", url: "https://css-tricks.com/" },
    { title: "W3Schools CSS", url: "https://www.w3schools.com/css/" },
    { title: "Flexbox Guide", url: "https://css-tricks.com/snippets/css/a-guide-to-flexbox/" },
    { title: "Grid Guide", url: "https://css-tricks.com/snippets/css/complete-guide-grid/" },
  ],
  typescript: [
    { title: "TypeScript Handbook", url: "https://www.typescriptlang.org/docs/" },
    { title: "TypeScript for JavaScript Programmers", url: "https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html" },
    { title: "TypeScript Playground", url: "https://www.typescriptlang.org/play" },
  ],
  debugging: [
    { title: "Chrome DevTools Guide", url: "https://developer.chrome.com/docs/devtools/" },
    { title: "Debugging Node.js", url: "https://nodejs.org/en/docs/guides/debugging-getting-started/" },
    { title: "VS Code Debugging", url: "https://code.visualstudio.com/docs/editor/debugging" },
  ],
  career: [
    { title: "FreeCodeCamp Curriculum", url: "https://www.freecodecamp.org/" },
    { title: "GitHub Learning Lab", url: "https://lab.github.com/" },
    { title: "LeetCode Problems", url: "https://leetcode.com/" },
    { title: "HackerRank Challenges", url: "https://www.hackerrank.com/" },
  ],
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OpenAIChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: "json_object" };
}

interface PipelineReviewResult {
  approved: boolean;
  matchesUserRequest: boolean;
  worksLikely: boolean;
  updatedUserQuery: string;
  reviewerNotes: string;
  fixes: string[];
}

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function isTlsCertificateError(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } } | null;
  const code = candidate?.code || candidate?.cause?.code;
  return code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" || code === "SELF_SIGNED_CERT_IN_CHAIN" || code === "DEPTH_ZERO_SELF_SIGNED_CERT";
}

function getOpenAIDispatcher() {
  if (openAIDispatcher !== undefined) {
    return openAIDispatcher;
  }

  if (OPENAI_CA_CERT_PATH) {
    if (!existsSync(OPENAI_CA_CERT_PATH)) {
      throw new Error(`OPENAI_CA_CERT_PATH does not exist: ${OPENAI_CA_CERT_PATH}`);
    }

    openAIDispatcher = new Agent({
      connect: {
        ca: readFileSync(OPENAI_CA_CERT_PATH, "utf8"),
      },
    });
    return openAIDispatcher;
  }

  if (OPENAI_ALLOW_INSECURE_TLS && process.env.NODE_ENV !== "production") {
    openAIDispatcher = new Agent({
      connect: {
        rejectUnauthorized: false,
      },
    });
    return openAIDispatcher;
  }

  openAIDispatcher = null;
  return openAIDispatcher;
}

async function fetchOpenAI(url: string, init: RequestInit) {
  try {
    const dispatcher = getOpenAIDispatcher();
    if (!dispatcher) {
      return await fetch(url, init);
    }

    return await fetch(url, {
      ...init,
      dispatcher,
    } as RequestInit & { dispatcher: Dispatcher });
  } catch (error) {
    if (isTlsCertificateError(error)) {
      throw new Error(
        "OpenAI TLS validation failed. Configure NODE_EXTRA_CA_CERTS before starting the dev server, or set OPENAI_CA_CERT_PATH to a PEM file for your local root certificate."
      );
    }

    throw error;
  }
}

async function withOptionalPersistence<T>(
  label: string,
  action: () => Promise<T>,
  fallback: T
): Promise<{ value: T; available: boolean }> {
  try {
    return {
      value: await action(),
      available: true,
    };
  } catch (error) {
    if (isPersistenceUnavailableError(error)) {
      console.warn(`${label} unavailable; continuing without persistence.`, error);
      return {
        value: fallback,
        available: false,
      };
    }

    throw error;
  }
}

function normalizeModelOutput(content: unknown) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

async function callOpenAIChat(messages: Message[], options: OpenAIChatOptions = {}) {
  const response = await fetchOpenAI(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: options.model || OPENAI_DEFAULT_MODEL,
      messages,
      max_tokens: options.maxTokens ?? 1000,
      temperature: options.temperature ?? 0.7,
      ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("OpenAI API error:", errorData);
    throw new Error(errorData.error?.message || "Failed to get AI response");
  }

  const data = await response.json();
  const content = normalizeModelOutput(data.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error("No response from AI");
  }

  return content;
}

function parsePipelineReviewResult(content: string): PipelineReviewResult {
  let parsed: Partial<PipelineReviewResult> = {};

  try {
    parsed = JSON.parse(content) as Partial<PipelineReviewResult>;
  } catch (error) {
    console.error("Failed to parse pipeline review result:", error, content);
    return {
      approved: false,
      matchesUserRequest: false,
      worksLikely: false,
      updatedUserQuery: "Revise the answer so it fully satisfies the user request and fixes the identified issues.",
      reviewerNotes: "The internal reviewer returned an invalid result. Regenerate the answer more clearly and completely.",
      fixes: ["Return a complete answer.", "Ensure the response is specific to the user's request.", "Provide well-formed code blocks when code is needed."],
    };
  }

  return {
    approved: Boolean(parsed.approved),
    matchesUserRequest: Boolean(parsed.matchesUserRequest),
    worksLikely: Boolean(parsed.worksLikely),
    updatedUserQuery: typeof parsed.updatedUserQuery === "string" && parsed.updatedUserQuery.trim().length > 0
      ? parsed.updatedUserQuery.trim()
      : "Revise the answer so it fully satisfies the user request and fixes the identified issues.",
    reviewerNotes: typeof parsed.reviewerNotes === "string" && parsed.reviewerNotes.trim().length > 0
      ? parsed.reviewerNotes.trim()
      : "The answer needs revision.",
    fixes: Array.isArray(parsed.fixes)
      ? parsed.fixes.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [],
  };
}

async function reviewLocoResponse(input: {
  systemPrompt: string;
  recentMessages: Message[];
  latestUserMessage: string;
  candidateResponse: string;
  attachmentContext: string;
  previewRuntimeIssueContext: string;
  codeSummary: string;
  formattedCode: string;
  currentLanguage: string;
}) {
  const reviewPrompt = `You are Loco's internal QA reviewer. Review the draft response against the latest user request.

Decide whether the response likely works and whether it actually satisfies what the user asked for.

Rules:
- Be strict.
- If runtime feedback or sandbox error details are present, treat them as real failures.
- If the answer asks for packages, setup steps, imports, or file placement that are missing, mark it as not likely to work.
- If the response is incomplete, generic, or does not directly fulfill the request, mark it as not approved.
- If the response is acceptable, keep updatedUserQuery focused and concise.
- Return JSON only.

Return this exact shape:
{
  "approved": boolean,
  "matchesUserRequest": boolean,
  "worksLikely": boolean,
  "updatedUserQuery": string,
  "reviewerNotes": string,
  "fixes": string[]
}`;

  const reviewMessages: Message[] = [
    { role: "system", content: reviewPrompt },
    { role: "system", content: `PRIMARY LOCO SYSTEM PROMPT:\n${input.systemPrompt}` },
    ...(input.attachmentContext ? [{ role: "system" as const, content: `ATTACHMENT CONTEXT:\n${input.attachmentContext}` }] : []),
    ...(input.previewRuntimeIssueContext ? [{ role: "system" as const, content: input.previewRuntimeIssueContext }] : []),
    ...(input.codeSummary ? [{ role: "system" as const, content: `CODE SUMMARY:\n${input.codeSummary}` }] : []),
    ...(input.formattedCode ? [{ role: "system" as const, content: `CURRENT CODE WITH LINE NUMBERS:\n${input.formattedCode}` }] : []),
    { role: "system", content: `CURRENT LANGUAGE: ${input.currentLanguage}` },
    ...input.recentMessages,
    { role: "system", content: `LATEST USER REQUEST:\n${input.latestUserMessage}` },
    { role: "assistant", content: input.candidateResponse },
  ];

  const reviewResponse = await callOpenAIChat(reviewMessages, {
    temperature: 0.1,
    maxTokens: 500,
    responseFormat: { type: "json_object" },
  });

  return parsePipelineReviewResult(reviewResponse);
}

function formatEventSuccessMessage(event: {
  title: string;
  startIso: Date;
  endIso: Date;
  timeZone: string;
  htmlLink?: string | null;
}) {
  const startFormatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: event.timeZone,
  });
  const endFormatter = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: event.timeZone,
  });

  return `Your event is on the calendar.\n\n- Title: ${event.title}\n- Starts: ${startFormatter.format(event.startIso)}\n- Ends: ${endFormatter.format(event.endIso)}\n- Time zone: ${event.timeZone}${event.htmlLink ? `\n- Link: ${event.htmlLink}` : ""}`;
}

function isCancellationReply(text: string) {
  return /^(no|cancel|never mind|dont|don't add it|stop)\b/i.test(text.trim());
}

function looksLikeReplyDraftRequest(text: string) {
  const normalized = normalizeWhitespace(text);

  if (!normalized) {
    return false;
  }

  const draftingPattern = /\b(how should i respond|how do i respond|help me respond|help me reply|draft(?: me)?(?: a)? reply|draft(?: me)?(?: an)? email|write(?: me)?(?: a)? reply|write(?: me)?(?: an)? email|what should i say|how should i answer|respond to this|reply to this|write back|send back)\b/i;
  const emailThreadPattern = /\b(?:from|to|subject):\b|\b(?:happy monday|looking forward to|let me know what works|availability below|don't hesitate to reach out|cheers,)\b/i;

  return draftingPattern.test(normalized) || (normalized.includes("@") && emailThreadPattern.test(normalized));
}

function looksLikeCalendarMemoryQuestion(text: string) {
  return /(what|which|show|list|remember|remind me)[\s\S]*(calendar|event|events|meeting|meetings|appointment|appointments|scheduled|schedule)/i.test(
    text.trim()
  );
}

function formatRememberedEventsMessage(
  events: Array<{
    title: string;
    startIso: Date;
    endIso: Date;
    timeZone: string;
    location?: string | null;
    htmlLink?: string | null;
  }>
) {
  if (events.length === 0) {
    return "I don't have any saved calendar events in memory yet.";
  }

  return `Here are the most recent calendar events I remember from Loco:\n\n${events
    .map((event) => {
      const formatter = new Intl.DateTimeFormat("en-US", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: event.timeZone,
      });

      return `- ${event.title} on ${formatter.format(event.startIso)}${event.location ? ` at ${event.location}` : ""}${event.htmlLink ? `\n  Link: ${event.htmlLink}` : ""}`;
    })
    .join("\n")}`;
}

function fallbackCalendarTitleFromRequest(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const patterns = [
    /(?:set[- ]?up|schedule|add|create|plan|book|put)\s+(?:a\s+)?(?:reminder|event|appointment|meeting)\s+(?:on\s+my\s+calend(?:a|e)r\s+)?to\s+(.+?)(?=\s+(?:on|at|around|tomorrow|today|tonight|later\s+today|next|this)\b|$)/i,
    /(?:remind(?: me)?(?: to)?|reminder)\s+(?:on\s+my\s+calend(?:a|e)r\s+)?to\s+(.+?)(?=\s+(?:on|at|around|tomorrow|today|tonight|later\s+today|next|this)\b|$)/i,
    /(?:remind(?: me)?(?: to)?|reminder)\s+(?:for|about)\s+(.+?)(?=\s+(?:on|at|around|tomorrow|today|tonight|later\s+today|next|this)\b|$)/i,
    /(?:reminder|event|appointment|meeting)\s+(?:for|about)\s+(.+?)(?=\s+(?:on|at|around|tomorrow|today|next|this)\b|$)/i,
    /(?:set[- ]?up|schedule|add|create|plan|book|put)\s+(?:a\s+)?(?:reminder|event|appointment|meeting)\s+(?:for|about)?\s*(.+?)(?=\s+(?:on|at|around|tomorrow|today|next|this)\b|$)/i,
    /(?:for)\s+(.+?)(?=\s+(?:on|at|around)\b|$)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const candidate = match?.[1]
      ?.replace(/^(?:a|an|the|my)\s+/i, "")
      ?.replace(/^on\s+my\s+calend(?:a|e)r\s+to\s+/i, "")
      .replace(/\s+(?:please|pls)$/i, "")
      .trim();
    if (candidate) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1);
    }
  }

  return "Reminder";
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function looksLikeCalendarCreateRequest(text: string) {
  const normalized = normalizeWhitespace(text);
  return /\b(remind(?: me)?(?: to)?|reminder|schedule|add|create|book|set[- ]?up|put|plan)\b/i.test(normalized)
    && /\b(calendar|calender|event|events|appointment|appointments|meeting|meetings|today|tomorrow|tonight|this\s+(?:morning|afternoon|evening|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|around\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i.test(normalized);
}

function looksLikeLiveCalendarReadRequest(text: string) {
  const normalized = normalizeWhitespace(text);
  if (looksLikeCalendarCreateRequest(normalized)) {
    return false;
  }

  return /(what(?:'s| is)|show|list|tell me|how busy)[\s\S]*(calendar|calender|schedule|agenda|events?)/i.test(normalized)
    || /(calendar|calender|schedule|agenda|events?)[\s\S]*(today|tomorrow|tonight|this\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(normalized);
}

function looksLikeLiveCalendarDeleteRequest(text: string) {
  const normalized = normalizeWhitespace(text);
  return /(remove|delete|clear|cancel)[\s\S]*(event|events|meeting|meetings|appointment|appointments)/i.test(normalized)
    && /(calendar|calender|schedule|agenda|today|tomorrow|tonight|this\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(normalized);
}

function previousAssistantAskedLiveDeleteConfirmation(messages: Array<{ role: string; content: string }>) {
  const previousAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  return previousAssistant?.content.includes(LIVE_CALENDAR_DELETE_MARKER) ?? false;
}

function getUserMessageBeforeLatestAssistant(messages: Array<{ role: string; content: string }>) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") {
      for (let candidate = index - 1; candidate >= 0; candidate -= 1) {
        if (messages[candidate]?.role === "user") {
          return messages[candidate].content;
        }
      }
      break;
    }
  }

  return null;
}

function getTimeZoneOffsetString(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const timeZoneName = parts.find((part) => part.type === "timeZoneName")?.value;

  if (!timeZoneName || timeZoneName === "GMT") {
    return "Z";
  }

  const match = timeZoneName.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) {
    return "Z";
  }

  const [, sign, hours, minutes] = match;
  return `${sign}${hours.padStart(2, "0")}:${(minutes || "00").padStart(2, "0")}`;
}

function getTimeZoneDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);

  return {
    weekday: parts.find((part) => part.type === "weekday")?.value.toLowerCase() || "",
    year: Number(parts.find((part) => part.type === "year")?.value || "0"),
    month: Number(parts.find((part) => part.type === "month")?.value || "0"),
    day: Number(parts.find((part) => part.type === "day")?.value || "0"),
  };
}

function addDaysInTimeZone(date: Date, timeZone: string, days: number) {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return getTimeZoneDateParts(shifted, timeZone);
}

function buildZonedIso(parts: { year: number; month: number; day: number }, hours: number, minutes: number, seconds: number, timeZone: string) {
  const year = String(parts.year).padStart(4, "0");
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  const hour = String(hours).padStart(2, "0");
  const minute = String(minutes).padStart(2, "0");
  const second = String(seconds).padStart(2, "0");
  const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, Math.min(Math.max(hours, 0), 23), minutes, seconds));
  const offset = getTimeZoneOffsetString(probe, timeZone);

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}

function resolveCalendarDayRange(text: string, timeZone: string, now: Date, options?: { defaultToToday?: boolean }) {
  const normalized = normalizeWhitespace(text).toLowerCase();
  const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const current = getTimeZoneDateParts(now, timeZone);
  const currentWeekdayIndex = weekdayNames.indexOf(current.weekday);

  let label = "today";
  let target = current;

  if (/\bthis week\b/.test(normalized)) {
    const daysFromMonday = currentWeekdayIndex === 0 ? 6 : currentWeekdayIndex - 1;
    const weekStart = addDaysInTimeZone(now, timeZone, -daysFromMonday);
    const weekEnd = addDaysInTimeZone(now, timeZone, 7 - daysFromMonday);

    return {
      label: "this week",
      startIso: buildZonedIso(weekStart, 0, 0, 0, timeZone),
      endIso: buildZonedIso(weekEnd, 0, 0, 0, timeZone),
    };
  }

  if (/\bnext week\b/.test(normalized)) {
    const daysFromMonday = currentWeekdayIndex === 0 ? 6 : currentWeekdayIndex - 1;
    const nextWeekStart = addDaysInTimeZone(now, timeZone, 7 - daysFromMonday);
    const nextWeekEnd = addDaysInTimeZone(now, timeZone, 14 - daysFromMonday);

    return {
      label: "next week",
      startIso: buildZonedIso(nextWeekStart, 0, 0, 0, timeZone),
      endIso: buildZonedIso(nextWeekEnd, 0, 0, 0, timeZone),
    };
  }

  if (/\btomorrow\b/.test(normalized)) {
    label = "tomorrow";
    target = addDaysInTimeZone(now, timeZone, 1);
  } else if (/\btoday\b|\btonight\b|\bcurrent(?:ly)?\b|\bright now\b|\bnow\b/.test(normalized)) {
    label = "today";
    target = current;
  } else {
    const weekdayMatch = normalized.match(/\b(?:(this|next)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (!weekdayMatch) {
      if (options?.defaultToToday) {
        return {
          label,
          startIso: buildZonedIso(target, 0, 0, 0, timeZone),
          endIso: buildZonedIso(addDaysInTimeZone(new Date(Date.UTC(target.year, target.month - 1, target.day, 12, 0, 0)), timeZone, 1), 0, 0, 0, timeZone),
        };
      }

      return null;
    }

    const modifier = weekdayMatch[1] || "this";
    const requestedWeekday = weekdayMatch[2];
    const requestedIndex = weekdayNames.indexOf(requestedWeekday);
    if (requestedIndex === -1 || currentWeekdayIndex === -1) {
      return null;
    }

    let delta = (requestedIndex - currentWeekdayIndex + 7) % 7;
    if (modifier === "next") {
      delta = delta === 0 ? 7 : delta;
    }

    target = addDaysInTimeZone(now, timeZone, delta);
    label = modifier === "next" ? `next ${requestedWeekday}` : requestedWeekday;
  }

  const endTarget = addDaysInTimeZone(new Date(Date.UTC(target.year, target.month - 1, target.day, 12, 0, 0)), timeZone, 1);

  return {
    label,
    startIso: buildZonedIso(target, 0, 0, 0, timeZone),
    endIso: buildZonedIso(endTarget, 0, 0, 0, timeZone),
  };
}

function formatLiveCalendarEventsMessage(
  events: Array<{
    title: string;
    startIso: string | null;
    endIso: string | null;
    isAllDay: boolean;
    location?: string | null;
    htmlLink?: string | null;
  }>,
  label: string,
  timeZone: string
) {
  if (events.length === 0) {
    return `Your Google Calendar looks clear for ${label}.`;
  }

  const shouldShowDate = /week/.test(label);

  const formattedEvents = events.map((event, index) => {
    const lines: string[] = [`${index + 1}. **${event.title}**`];

    if (!event.startIso) {
      if (event.htmlLink) {
        lines.push(`   Open: [Google Calendar](${event.htmlLink})`);
      }
      return lines.join("\n");
    }

    if (event.isAllDay) {
      if (shouldShowDate) {
        const start = new Date(event.startIso);
        const dateFormatter = new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone,
        });
        lines.push(`   When: ${dateFormatter.format(start)} · All day`);
      } else {
        lines.push("   Time: All day");
      }
    } else {
      const start = new Date(event.startIso);
      const end = event.endIso ? new Date(event.endIso) : null;
      const timeFormatter = new Intl.DateTimeFormat("en-US", {
        timeStyle: "short",
        timeZone,
      });
      const dateFormatter = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone,
      });

      lines.push(
        shouldShowDate
          ? `   When: ${dateFormatter.format(start)} · ${timeFormatter.format(start)}${end ? ` to ${timeFormatter.format(end)}` : ""}`
          : `   Time: ${timeFormatter.format(start)}${end ? ` to ${timeFormatter.format(end)}` : ""}`
      );
    }

    if (event.location) {
      lines.push(`   Location: ${event.location}`);
    }

    if (event.htmlLink) {
      lines.push(`   Open: [Google Calendar](${event.htmlLink})`);
    }

    return lines.join("\n");
  });

  return `Here is your Google Calendar for ${label}:\n\n${formattedEvents.join("\n\n")}`;
}

function formatLiveCalendarDeleteConfirmation(
  events: Array<{
    title: string;
    startIso: string | null;
    endIso: string | null;
    isAllDay: boolean;
    location?: string | null;
  }>,
  label: string,
  timeZone: string
) {
  return `${LIVE_CALENDAR_DELETE_MARKER}\n\nI found ${events.length} event${events.length === 1 ? "" : "s"} on ${label}:\n${events
    .map((event) => {
      if (!event.startIso) {
        return `- ${event.title}`;
      }

      if (event.isAllDay) {
        return `- ${event.title} (all day)`;
      }

      const start = new Date(event.startIso);
      const end = event.endIso ? new Date(event.endIso) : null;
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeStyle: "short",
        timeZone,
      });

      return `- ${event.title} from ${formatter.format(start)}${end ? ` to ${formatter.format(end)}` : ""}${event.location ? ` at ${event.location}` : ""}`;
    })
    .join("\n")}\n\nReply with "yes" to delete them, or "no" to keep them.`;
}

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const {
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
    } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages are required" },
        { status: 400 }
      );
    }

    const latestMessage = messages[messages.length - 1];
    let latestUserMessage = latestMessage?.content?.trim();
    let latestRole = latestMessage?.role;

    if (autoFixPreview && latestRole !== "user") {
      latestUserMessage = getUserMessageBeforeLatestAssistant(messages) || latestUserMessage;
      latestRole = latestUserMessage ? "user" : latestRole;
    }

    if (!latestUserMessage || latestRole !== "user") {
      return NextResponse.json(
        { error: "Latest message must be a user message" },
        { status: 400 }
      );
    }

    if (looksLikeMemoryRecallQuestion(latestUserMessage)) {
      const memoryRecall = await withOptionalPersistence(
        "Assistant memory recall",
        () => formatAssistantMemoryRecall(),
        "I can't access saved memories right now because chat persistence is unavailable."
      );

      return NextResponse.json({
        success: true,
        message: memoryRecall.value,
        audio: null,
      });
    }

    if (isExplicitMemoryRequest(latestUserMessage)) {
      const memoryContent = extractMemoryContent(latestUserMessage);

      if (!memoryContent) {
        return NextResponse.json({
          success: true,
          message: "Tell me what you want me to remember, for example: remember that I prefer short answers.",
          audio: null,
        });
      }

      const memorySave = await withOptionalPersistence(
        "Assistant memory save",
        async () => {
          await rememberAssistantFact(memoryContent, "explicit");
          return true;
        },
        false
      );

      return NextResponse.json({
        success: true,
        message: memorySave.value
          ? `I'll remember that: ${memoryContent}`
          : `I heard that, but I can't save memories right now because chat persistence is unavailable.`,
        audio: null,
      });
    }

    if (
      previousAssistantAskedLiveDeleteConfirmation(messages) &&
      isCalendarConfirmationReply(latestUserMessage)
    ) {
      const originalDeleteRequest = getUserMessageBeforeLatestAssistant(messages);

      if (!originalDeleteRequest) {
        return NextResponse.json({
          success: true,
          message: "I couldn't recover the pending delete request. Please ask me again which day to clear.",
          audio: null,
        });
      }

      const connection = await withOptionalPersistence(
        "Google Calendar connection lookup",
        () => getStoredCalendarConnection(),
        null
      );
      if (!connection.available) {
        return NextResponse.json({
          success: true,
          message: "I can't access the saved Google Calendar connection right now because chat persistence is unavailable.",
          audio: null,
        });
      }

      if (!connection.value) {
        return NextResponse.json({
          success: true,
          message: "Google Calendar is not connected yet. Open Settings, connect your Google account, then ask me again.",
          audio: null,
        });
      }

      const range = resolveCalendarDayRange(originalDeleteRequest, timeZone, new Date());
      if (!range) {
        return NextResponse.json({
          success: true,
          message: "I couldn't determine which day to clear. Please restate the request with a specific day.",
          audio: null,
        });
      }

      const events = await listCalendarEvents({
        startIso: range.startIso,
        endIso: range.endIso,
        origin: request.nextUrl.origin,
        limit: 250,
      });

      if (events.length === 0) {
        return NextResponse.json({
          success: true,
          message: `There are no Google Calendar events left on ${range.label}.`,
          audio: null,
        });
      }

      await deleteCalendarEvents({
        eventIds: events.map((event) => event.id),
        origin: request.nextUrl.origin,
      });

      return NextResponse.json({
        success: true,
        message: `Deleted ${events.length} Google Calendar event${events.length === 1 ? "" : "s"} on ${range.label}.`,
        audio: null,
      });
    }

    if (
      previousAssistantAskedLiveDeleteConfirmation(messages) &&
      isCancellationReply(latestUserMessage)
    ) {
      return NextResponse.json({
        success: true,
        message: "Understood. I kept those Google Calendar events unchanged.",
        audio: null,
      });
    }

    const isReplyDraftRequest = looksLikeReplyDraftRequest(latestUserMessage);

    if (!isReplyDraftRequest && (looksLikeLiveCalendarDeleteRequest(latestUserMessage) || looksLikeLiveCalendarReadRequest(latestUserMessage))) {
      const connection = await withOptionalPersistence(
        "Google Calendar connection lookup",
        () => getStoredCalendarConnection(),
        null
      );
      if (!connection.available) {
        return NextResponse.json({
          success: true,
          message: "I can't access the saved Google Calendar connection right now because chat persistence is unavailable.",
          audio: null,
        });
      }

      if (!connection.value) {
        return NextResponse.json({
          success: true,
          message: "I can do that with Google Calendar, but Google Calendar is not connected yet. Open Settings, connect your Google account, then ask me again.",
          audio: null,
        });
      }

      const range = resolveCalendarDayRange(latestUserMessage, timeZone, new Date(), {
        defaultToToday: looksLikeLiveCalendarReadRequest(latestUserMessage) && !looksLikeLiveCalendarDeleteRequest(latestUserMessage),
      });
      if (!range) {
        return NextResponse.json({
          success: true,
          message: "Tell me which day you want, for example: today, tomorrow, or Thursday.",
          audio: null,
        });
      }

      try {
        const events = await listCalendarEvents({
          startIso: range.startIso,
          endIso: range.endIso,
          origin: request.nextUrl.origin,
          limit: 250,
        });

        if (looksLikeLiveCalendarDeleteRequest(latestUserMessage)) {
          if (events.length === 0) {
            return NextResponse.json({
              success: true,
              message: `I didn't find any Google Calendar events on ${range.label} to delete.`,
              audio: null,
            });
          }

          return NextResponse.json({
            success: true,
            message: formatLiveCalendarDeleteConfirmation(events, range.label, timeZone),
            audio: null,
          });
        }

        return NextResponse.json({
          success: true,
          message: formatLiveCalendarEventsMessage(events, range.label, timeZone),
          audio: null,
        });
      } catch (error) {
        console.error("Live Google Calendar query error:", error);
        return NextResponse.json({
          success: true,
          message: "I couldn't reach Google Calendar for that request. Reconnect Google Calendar in Settings and try again.",
          audio: null,
        });
      }
    }

    if (!isReplyDraftRequest && looksLikeCalendarMemoryQuestion(latestUserMessage)) {
      const rememberedEvents = await withOptionalPersistence(
        "Remembered calendar events lookup",
        () => listRememberedCalendarEvents(8),
        []
      );

      if (!rememberedEvents.available) {
        return NextResponse.json({
          success: true,
          message: "I can't access remembered calendar history right now because chat persistence is unavailable.",
          audio: null,
        });
      }

      return NextResponse.json({
        success: true,
        message: formatRememberedEventsMessage(rememberedEvents.value),
        audio: null,
      });
    }

    if (
      previousAssistantAskedToConfirm(messages) &&
      isCalendarConfirmationReply(latestUserMessage)
    ) {
      const pendingDraft = await withOptionalPersistence(
        "Pending calendar draft lookup",
        () => getLatestPendingDraft(),
        null
      );

      if (!pendingDraft.available) {
        return NextResponse.json({
          success: true,
          message: "I can't access pending Google Calendar drafts right now because chat persistence is unavailable.",
          audio: null,
        });
      }

      if (!pendingDraft.value) {
        return NextResponse.json({
          success: true,
          message: "I don't have a pending calendar draft right now. Ask me to schedule the event again and I'll prepare it.",
          audio: null,
        });
      }

      const draft = pendingDraft.value;

      try {
        const createdEvent = await createCalendarEvent({
          title: draft.title,
          description: draft.description,
          location: draft.location,
          startIso: draft.startIso.toISOString(),
          endIso: draft.endIso.toISOString(),
          timeZone: draft.timeZone,
          origin: request.nextUrl.origin,
          rawRequest: draft.rawRequest,
          sessionId: typeof sessionId === "string" ? sessionId : null,
        });

        await withOptionalPersistence(
          "Pending calendar draft cleanup",
          () => clearPendingDraft(draft.id),
          null
        );

        return NextResponse.json({
          success: true,
          message: formatEventSuccessMessage({
            title: draft.title,
            startIso: draft.startIso,
            endIso: draft.endIso,
            timeZone: draft.timeZone,
            htmlLink: createdEvent.htmlLink,
          }),
          audio: null,
        });
      } catch (error) {
        console.error("Google Calendar create event error:", error);
        return NextResponse.json({
          success: true,
          message: "I couldn't create the Google Calendar event. Reconnect Google Calendar in Settings and try again.",
          audio: null,
        });
      }
    }

    if (
      previousAssistantAskedToConfirm(messages) &&
      isCancellationReply(latestUserMessage)
    ) {
      const pendingDraft = await withOptionalPersistence(
        "Pending calendar draft lookup",
        () => getLatestPendingDraft(),
        null
      );
      if (pendingDraft.available && pendingDraft.value) {
        const draft = pendingDraft.value;
        await withOptionalPersistence(
          "Pending calendar draft cleanup",
          () => clearPendingDraft(draft.id),
          null
        );
      }

      return NextResponse.json({
        success: true,
        message: "Understood. I canceled the pending Google Calendar draft.",
        audio: null,
      });
    }

    if (previousAssistantAskedToConfirm(messages)) {
      return NextResponse.json({
        success: true,
        message:
          "I still have a Google Calendar draft waiting. Reply with \"yes\" to add it, \"no\" to cancel it, or restate the event details if you want me to prepare a revised draft.",
        audio: null,
      });
    }

    const isCalendarClarificationFollowUp =
      previousAssistantAskedCalendarClarification(messages) &&
      looksLikeCalendarClarificationFollowUp(latestUserMessage);

    if ((!isReplyDraftRequest && looksLikeCalendarIntent(latestUserMessage)) || isCalendarClarificationFollowUp) {
      const connection = await withOptionalPersistence(
        "Google Calendar connection lookup",
        () => getStoredCalendarConnection(),
        null
      );

      if (!connection.available) {
        return NextResponse.json({
          success: true,
          message: "I can't access the saved Google Calendar connection right now because chat persistence is unavailable.",
          audio: null,
        });
      }

      if (!connection.value) {
        return NextResponse.json({
          success: true,
          message:
            "I can add that to Google Calendar, but Google Calendar is not connected yet. Open Settings, connect your Google account, then ask me again.",
          audio: null,
        });
      }

      try {
        const parsedIntent = await parseCalendarIntent({
          apiKey: OPENAI_API_KEY,
          message: latestUserMessage,
          timeZone,
          nowIso: new Date().toISOString(),
        });

        if (parsedIntent.intent !== "create_event") {
          return NextResponse.json({
            success: true,
            message: "I didn't read that as a calendar request. If you want an event created, tell me the title plus the date and time.",
            audio: null,
          });
        }

        if (parsedIntent.needsClarification || !parsedIntent.event) {
          return NextResponse.json({
            success: true,
            message:
              parsedIntent.clarificationQuestion ||
              "I need a bit more detail before I can add that to Google Calendar. Tell me the date and time you want.",
            audio: null,
          });
        }

        const event = parsedIntent.event;

        const startDate = new Date(event.startIso);
        const endDate = new Date(event.endIso);

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
          return NextResponse.json({
            success: true,
            message: "I couldn't confidently parse the event time. Please restate it with a clearer date and time.",
            audio: null,
          });
        }

        const eventTitle =
          typeof event.title === "string" && event.title.trim().length > 0 && event.title.trim().toLowerCase() !== "reminder"
            ? event.title.trim()
            : fallbackCalendarTitleFromRequest(latestUserMessage);

        const draft = await withOptionalPersistence(
          "Pending calendar draft save",
          () => savePendingDraft({
            title: eventTitle,
            description: event.description,
            location: event.location,
            startIso: event.startIso,
            endIso: event.endIso,
            timeZone: event.timeZone || timeZone,
            rawRequest: latestUserMessage,
          }),
          null
        );

        if (!draft.available || !draft.value) {
          return NextResponse.json({
            success: true,
            message: "I parsed the event details, but I can't save a pending Google Calendar draft right now because chat persistence is unavailable.",
            audio: null,
          });
        }

        return NextResponse.json({
          success: true,
          message: formatDraftConfirmation(draft.value),
          audio: null,
        });
      } catch (error) {
        console.error("Calendar intent handling error:", error);
        return NextResponse.json({
          success: true,
          message: "I understood this as a calendar request, but I couldn't safely parse the event details. Try restating it with the title, date, time, and duration.",
          audio: null,
        });
      }
    }

    const implicitMemoryCandidate = inferImplicitMemoryCandidate(latestUserMessage);
    if (implicitMemoryCandidate) {
      await withOptionalPersistence(
        "Implicit assistant memory save",
        () => rememberAssistantFact(implicitMemoryCandidate, "implicit"),
        null
      );
    }

    let audioBase64 = null;
    const [previousContext, longTermMemoryContext, relevantAssistantMemoryResult, relevantConversationResult] = await Promise.all([
      withOptionalPersistence("Persistent conversation context", () => buildPersistentMemoryContext(), ""),
      withOptionalPersistence("Assistant memory context", () => buildAssistantMemoryContext(), ""),
      withOptionalPersistence(
        "Relevant assistant memory context",
        () => buildRelevantAssistantMemoryContext(latestUserMessage),
        { context: "", matches: [] } satisfies RelevantAssistantMemoryResult
      ),
      withOptionalPersistence(
        "Relevant conversation context",
        () => buildRelevantConversationContext(latestUserMessage),
        { context: "", matches: [] } satisfies RelevantConversationResult
      ),
    ]);
    const relevantAssistantMemoryContext = relevantAssistantMemoryResult.value.context;
    const relevantConversationContext = relevantConversationResult.value.context;
    const memorySources = [
      relevantAssistantMemoryContext ? "remembered facts" : null,
      relevantConversationContext ? "prior conversation" : null,
    ].filter((entry): entry is string => Boolean(entry));
    const memoryHit = memorySources.length > 0;
    const memoryMatches: {
      assistantMemories: RelevantAssistantMemoryMatch[];
      conversationMatches: RelevantConversationMatch[];
    } = {
      assistantMemories: relevantAssistantMemoryResult.value.matches,
      conversationMatches: relevantConversationResult.value.matches,
    };

    let codeSummary = "";
    let formattedCode = "";
    const attachmentContext = buildAttachmentPromptContext(
      Array.isArray(attachments) ? (attachments as AttachmentContextItem[]) : []
    );
    const previewRuntimeIssueContext = previewRuntimeIssue
      && typeof previewRuntimeIssue === "object"
      && typeof previewRuntimeIssue.message === "string"
      && previewRuntimeIssue.message.trim().length > 0
        ? `The user's last generated live preview failed in the sandbox. Treat this as concrete runtime feedback for the current request.

PREVIEW ERROR SOURCE: ${typeof previewRuntimeIssue.source === "string" && previewRuntimeIssue.source ? previewRuntimeIssue.source : "runtime"}
PREVIEW ERROR MESSAGE:
${previewRuntimeIssue.message.trim()}`
        : "";

    if (code) {
      formattedCode = formatCodeWithLineNumbers(code);
      codeSummary = buildCodeSummary(code, language || "javascript");
    }

    const languageNames: { [key: string]: string } = {
      javascript: "JavaScript",
      typescript: "TypeScript",
      python: "Python",
      html: "HTML",
      css: "CSS"
    };
    const currentLanguage = languageNames[language] || language || "code";

    let userGreeting = "";
    let userContext = "";

    if (user && user.firstName) {
      userGreeting = ` Greetings, sir. `;
      userContext = `\nSTUDENT PROFILE:\n- Name: ${user.firstName} ${user.lastName || ""}\n- Email: ${user.email}\n- You're working with them as their personal coding mentor${previousContext.value}${longTermMemoryContext.value}${relevantAssistantMemoryContext}${relevantConversationContext}`;
    } else {
      userContext = `${previousContext.value}${longTermMemoryContext.value}${relevantAssistantMemoryContext}${relevantConversationContext}`;
    }

    const systemPrompt = `You are Loco, an intelligent, calm, and highly capable AI assistant — modelled after JARVIS — who helps users with everyday needs while also teaching programming, debugging code, and helping build software.

Your mission is to help users **understand problems, solve them, and grow their skills**.

Always keep responses clear, concise, helpful, and encouraging.

${userGreeting}
${userContext}

If the current message overlaps with remembered facts or relevant prior conversation context, naturally acknowledge that connection when it is genuinely useful. Keep it brief and accurate. Do not invent memory details.

If the user asks to play a YouTube video or playlist, treat that as a direct media intent rather than a long-form explanation request. Prefer concise, action-oriented handling. Only ask a follow-up if the requested video, playlist, or topic is too vague to search safely.

# 🎭 PERSONALITY

You are:

• Calm, precise, and analytically intelligent
• A composed mentor who communicates with confidence and clarity
• Measured and deliberate - never rushed or chaotic
• Patient and thorough with beginners
• Supportive when users feel stuck
• Quietly passionate about elegant solutions

Your tone is:

**80% composed, analytical advisor**
**20% dry wit and understated confidence**

Address the user as "sir" when speaking directly, unless they explicitly ask you to use a different form of address.

You speak in short, deliberate sentences. Never long paragraphs when brevity will do.

You think in distinct ideas - one thought at a time.

Occasionally narrate your process: "Analyzing the issue.", "Scanning the code.", "Compiling results."

Use phrasing like: "It appears...", "Most likely...", "I recommend...", "The issue appears to be...", "That should resolve it."

Sound confident, analytical, and composed at all times - like a trusted intelligent system.

# SPEECH STYLE - JARVIS MODE

When responding:
- Use short, punchy sentences. One idea per sentence.
- Avoid filler words. Be direct and precise.
- Narrate complex work: "Running diagnostics.", "Cross-referencing the documentation."
- Deliver conclusions calmly: "That confirms the issue.", "The fix is straightforward."
- Acknowledge the user with quiet confidence: "Understood, sir.", "Noted, sir.", "Good question, sir."

# 🧠 CORE TEACHING STYLE

When explaining technical ideas:

• Break concepts into simple steps
• Avoid overwhelming walls of text
• Use analogies (games, sports, cooking, real-world systems)
• Highlight key ideas clearly
• Focus on **WHY something works**, not just WHAT it does

You are not just writing code.

You are **building confidence and teaching users how to think like engineers**.

Make technical concepts feel conquerable, not intimidating.

# 🔍 THE WHY-FIRST RULE

Whenever possible, clarify:

• The problem being solved
• The constraints involved
• Why the chosen solution works
• Trade-offs in the design

Ask occasional reasoning questions such as:

• “Why do you think this bug is happening?”
• “What would break if this dependency changed?”
• “Would this still work with 10,000 users?”

These questions should encourage thinking without overwhelming the user.

# 🏗 ARCHITECTURE AWARENESS

When relevant, connect small code decisions to larger concepts such as:

• Separation of concerns
• Component responsibility
• State management patterns
• Performance considerations
• Maintainability
• Scalability
• Readability vs cleverness

Help the user understand that:

**Small design decisions can have big long-term effects.**

• Briefly explain what the code does
• Mention where the code should go (file name or location)
• Provide quick usage instructions if helpful

Never repeat the same code outside the code block.

# 🛠 WHEN A USER REQUESTS CODE

Follow this process:

1. If the request is unclear → ask clarifying questions
2. Explain the approach briefly (1–2 sentences)
3. Provide the complete code solution
4. Mention file name or location
5. Provide quick instructions for using or running the code

Keep explanations short but informative.

# 🔧 DEBUGGING PHILOSOPHY

When helping debug code:

1. Identify the root problem
2. Explain **why it happens**
3. Show how to fix it
4. Suggest how to prevent it in the future

You are not just fixing bugs.

You are teaching users **how to hunt bugs themselves.**

Treat bugs like villains in a story that must be defeated.

# 🧪 LEARNING & EXPERIMENTATION

Encourage curiosity and experimentation.

Examples:

• “Try changing this value and see what happens 👀”
• “What happens if we remove this dependency?”
• “Rewrite this without useEffect — what changes?”

Learning improves when users **test ideas and observe outcomes.**

# 🎪 INTERACTION STYLE

Adapt your explanations to the user’s experience level.

If the user seems confused:
Slow down and simplify.

If the user seems advanced:
Increase depth and discuss architecture.

If the user sounds frustrated:
Acknowledge it and motivate them.

Occasionally ask engaging prompts like:

• “Do you want the quick version or the deep dive?”
• “Want me to mentally diagram how this works?”
• “Should we refactor this like pros?”

Make conversations feel like a **live coding session**, not a documentation dump.

# 🤪 PLAYFUL ENERGY

You may occasionally add playful flair such as:

“BOOM! That’s your state update.”

However:

• Clarity always comes first
• Humor should never reduce technical accuracy
• Keep jokes brief and supportive

# 🔁 REPEATED QUESTIONS

If a user repeats the same question multiple times:

First repeat → friendly reminder
Second repeat → explain in a different way
Third repeat → increase playful energy while still helping

Always keep answers useful while acknowledging the repetition.

# 🎯 FEEDBACK STYLE

When reviewing user code:

1. Start by highlighting what works well
2. Identify improvement areas
3. Explain why the improvement matters
4. Suggest a better version if needed
5. Explain the benefit of the improvement

Your goal is constructive growth.

# 💻 TERMINAL COMMAND FORMAT

When showing terminal commands, always format them like:

$ npm install
$ npm run dev

# 🚀 ULTIMATE GOAL

Your purpose is not just to solve problems.

Your purpose is to:

• Build user confidence
• Teach reasoning and engineering thinking
• Turn confusion into clarity
• Turn mistakes into lessons

You are:

A coding hype squad.
A debugging gladiator.
A chaos-powered educator.
A patient mentor.
A structured thinker with wild energy.

Make coding feel **alive, understandable, and achievable.**`;

    const recentMessages = messages.slice(-10).map((msg: { role: string; content: string }, index: number, source: Array<{ role: string; content: string }>) => {
      const isLatestUserMessage = index === source.length - 1 && msg.role === "user";
      return {
        role: msg.role as "user" | "assistant",
        content: isLatestUserMessage && attachmentContext
          ? `${msg.content}\n\n${attachmentContext}`
          : msg.content,
      };
    });

    const apiMessages: Message[] = [
      { role: "system", content: systemPrompt },
      ...(previewRuntimeIssueContext ? [{ role: "system" as const, content: previewRuntimeIssueContext }] : []),
      ...recentMessages,
    ];
    let aiMessage = await callOpenAIChat(apiMessages, {
      temperature: 0.7,
      maxTokens: 1000,
    });

    let pipelineReview = await reviewLocoResponse({
      systemPrompt,
      recentMessages: apiMessages.filter((message) => message.role !== "system"),
      latestUserMessage,
      candidateResponse: aiMessage,
      attachmentContext,
      previewRuntimeIssueContext,
      codeSummary,
      formattedCode,
      currentLanguage,
    });

    if (!pipelineReview.approved || !pipelineReview.matchesUserRequest || !pipelineReview.worksLikely) {
      const revisionInstruction = `You are revising your previous answer after an internal quality review.

Original user request:
${latestUserMessage}

Updated user query:
${pipelineReview.updatedUserQuery}

Review notes:
${pipelineReview.reviewerNotes}

Required fixes:
${pipelineReview.fixes.length > 0 ? pipelineReview.fixes.map((fix, index) => `${index + 1}. ${fix}`).join("\n") : "1. Make the answer directly satisfy the request.\n2. Ensure the proposed code is likely to work."}

Instructions:
- Return the improved final answer only.
- Do not mention the internal review process.
- If code is needed, provide the corrected complete code.
- If the runtime error indicates the previous approach failed, replace it with a working one.`;

      aiMessage = await callOpenAIChat([
        ...apiMessages,
        { role: "assistant", content: aiMessage },
        { role: "system", content: revisionInstruction },
      ], {
        temperature: 0.35,
        maxTokens: 1200,
      });

      pipelineReview = await reviewLocoResponse({
        systemPrompt,
        recentMessages: apiMessages.filter((message) => message.role !== "system"),
        latestUserMessage,
        candidateResponse: aiMessage,
        attachmentContext,
        previewRuntimeIssueContext,
        codeSummary,
        formattedCode,
        currentLanguage,
      });
    }

    if (voice && aiMessage && TTS_PROVIDER !== "browser") {
      try {
        if (TTS_PROVIDER === "gemini") {
          if (!GEMINI_API_KEY) {
            console.error("Gemini API key not configured for TTS");
          } else {
            const voiceMap: { [key: string]: string } = {
              alloy: "en-US-Neural2-A",
              echo: "en-US-Neural2-C",
              fable: "en-US-Neural2-E",
            };
            const googleVoiceName = voiceMap[voice] || "en-US-Neural2-C";

            const ttsResponse = await fetch(
              `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GEMINI_API_KEY}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  input: { text: aiMessage },
                  voice: {
                    languageCode: "en-US",
                    name: googleVoiceName,
                  },
                  audioConfig: {
                    audioEncoding: "MP3",
                    pitch: 0,
                    speakingRate: 1.0,
                  },
                }),
              }
            );
            if (ttsResponse.ok) {
              const ttsData = await ttsResponse.json();
              if (ttsData.audioContent) {
                audioBase64 = ttsData.audioContent;
                console.log("Google TTS audio generated successfully");
              } else {
                console.error("No audio content in response:", ttsData);
              }
            } else {
              const errorData = await ttsResponse.text();
              console.error("Google TTS error:", ttsResponse.status, errorData);
            }
          }
        } else {
          const ttsResponse = await fetchOpenAI("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "tts-1",
              input: aiMessage,
              voice: voice,
              response_format: "mp3",
            }),
          });
          if (ttsResponse.ok) {
            const audioBuffer = await ttsResponse.arrayBuffer();
            const base64Audio = Buffer.from(audioBuffer).toString("base64");
            audioBase64 = base64Audio;
          } else {
            console.error("OpenAI TTS API error:", ttsResponse.status, ttsResponse.statusText);
          }
        }
      } catch (e) {
        console.error("TTS error", e);
      }
    }

    if (code && aiMessage) {
      const mentionedLines = extractLineNumbersFromResponse(aiMessage);
      if (mentionedLines.length > 0) {
        const { invalid } = validateLineNumbers(code, mentionedLines);
        if (invalid.length > 0) {
          console.warn("AI mentioned invalid line numbers:", invalid);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: aiMessage,
      audio: audioBase64,
      memoryHit,
      memorySources,
      memoryMatches,
      pipeline: {
        approved: pipelineReview.approved,
        matchesUserRequest: pipelineReview.matchesUserRequest,
        worksLikely: pipelineReview.worksLikely,
        updatedUserQuery: pipelineReview.updatedUserQuery,
        reviewerNotes: pipelineReview.reviewerNotes,
        fixes: pipelineReview.fixes,
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);

    if (error instanceof Error && error.message.startsWith("OpenAI TLS validation failed")) {
      return NextResponse.json(
        { error: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
