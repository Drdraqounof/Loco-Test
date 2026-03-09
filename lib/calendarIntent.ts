import { prisma } from "@/lib/prisma";

const CALENDAR_INTENT_PATTERN = /\b(schedule|add|create|book|set up|put|plan)\b[\s\S]*\b(calendar|meeting|appointment|event|reminder|call|lunch|dinner)\b|\b(on my calendar|to my calendar|in my calendar)\b/i;
const AFFIRMATIVE_PATTERN = /^(yes|yep|yeah|confirm|do it|go ahead|please do|sounds good|add it|create it)\b/i;
const DRAFT_MARKER = "Google Calendar draft ready.";

export interface CalendarDraftInput {
  title: string;
  description?: string | null;
  location?: string | null;
  startIso: string;
  endIso: string;
  timeZone: string;
  rawRequest: string;
}

export interface ParsedCalendarIntent {
  intent: "create_event" | "none";
  needsClarification: boolean;
  clarificationQuestion?: string;
  missingFields?: string[];
  event?: {
    title: string;
    description?: string | null;
    location?: string | null;
    startIso: string;
    endIso: string;
    timeZone: string;
  };
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model response");
  }
  return JSON.parse(text.slice(start, end + 1));
}

export function looksLikeCalendarIntent(text: string) {
  return CALENDAR_INTENT_PATTERN.test(text);
}

export function isCalendarConfirmationReply(text: string) {
  return AFFIRMATIVE_PATTERN.test(text.trim());
}

export function previousAssistantAskedToConfirm(messages: Array<{ role: string; content: string }>) {
  const previousAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  return previousAssistant?.content.includes(DRAFT_MARKER) ?? false;
}

export function formatDraftConfirmation(draft: {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startIso: Date;
  endIso: Date;
  timeZone: string;
}) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: draft.timeZone,
  });
  const endFormatter = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: draft.timeZone,
  });

  return `${DRAFT_MARKER}\n\nI parsed this event:\n- Title: ${draft.title}\n- Starts: ${formatter.format(draft.startIso)}\n- Ends: ${endFormatter.format(draft.endIso)}\n- Time zone: ${draft.timeZone}${draft.location ? `\n- Location: ${draft.location}` : ""}${draft.description ? `\n- Notes: ${draft.description}` : ""}\n\nReply with \"yes\" and I’ll add it to your Google Calendar.`;
}

export async function savePendingDraft(input: CalendarDraftInput) {
  await prisma.pendingCalendarDraft.deleteMany({
    where: {
      source: "loco",
    },
  });

  return prisma.pendingCalendarDraft.create({
    data: {
      source: "loco",
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      startIso: new Date(input.startIso),
      endIso: new Date(input.endIso),
      timeZone: input.timeZone,
      rawRequest: input.rawRequest,
      needsConfirmation: true,
    },
  });
}

export async function getLatestPendingDraft() {
  return prisma.pendingCalendarDraft.findFirst({
    where: {
      source: "loco",
      needsConfirmation: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function clearPendingDraft(id: string) {
  await prisma.pendingCalendarDraft.delete({
    where: { id },
  });
}

export async function parseCalendarIntent(params: {
  apiKey: string;
  message: string;
  timeZone: string;
  nowIso: string;
}) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 350,
      messages: [
        {
          role: "system",
          content:
            "You extract calendar event details from a user request. Return JSON only. If the request is not about creating a calendar event, return {\"intent\":\"none\",\"needsClarification\":false}. For relative dates, resolve from the provided current timestamp and timezone. Default duration to 60 minutes if none is given. Use ISO-8601 strings for startIso and endIso. If required scheduling details are missing, return needsClarification true with missingFields and a short clarificationQuestion.",
        },
        {
          role: "user",
          content: JSON.stringify({
            nowIso: params.nowIso,
            timeZone: params.timeZone,
            request: params.message,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Calendar intent parsing failed with ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Calendar intent parsing returned no content");
  }

  return extractJsonObject(content) as ParsedCalendarIntent;
}