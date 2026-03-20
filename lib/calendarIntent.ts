import { prisma } from "@/lib/prisma";

// In plain terms: this file figures out whether the user is trying to create, confirm, or change a calendar event.

const CALENDAR_NOUN_PATTERN = /\b(remind(?: me)?(?: to)?|reminder|alarm|appointment|meeting|event|calendar|call|lunch|dinner)\b|\b(on my calendar|to my calendar|in my calendar)\b/i;
const CALENDAR_ACTION_WITH_CONTEXT_PATTERN = /\b(schedule|add|create|book|set[- ]?up|put|plan)\b/i;
const CALENDAR_DATE_TIME_PATTERN = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|today|tomorrow|tonight|this\s+(?:morning|afternoon|evening|weekend)|next\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|around\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i;
const AFFIRMATIVE_PATTERN = /^(yes|yep|yeah|confirm|do it|go ahead|please do|sounds good|add it|create it)\b/i;
const DRAFT_MARKER = "Google Calendar draft ready.";
const CALENDAR_CLARIFICATION_MARKERS = [
  "I need a bit more detail before I can add that to Google Calendar.",
  "I understood this as a calendar request",
  "I didn't read that as a calendar request.",
  "I couldn't confidently parse the event time.",
];

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
  return CALENDAR_NOUN_PATTERN.test(text) || (CALENDAR_ACTION_WITH_CONTEXT_PATTERN.test(text) && CALENDAR_DATE_TIME_PATTERN.test(text));
}

export function isCalendarConfirmationReply(text: string) {
  return AFFIRMATIVE_PATTERN.test(text.trim());
}

export function previousAssistantAskedToConfirm(messages: Array<{ role: string; content: string }>) {
  const previousAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  return previousAssistant?.content.includes(DRAFT_MARKER) ?? false;
}

export function previousAssistantAskedCalendarClarification(messages: Array<{ role: string; content: string }>) {
  const previousAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  if (!previousAssistant) {
    return false;
  }

  return CALENDAR_CLARIFICATION_MARKERS.some((marker) => previousAssistant.content.includes(marker));
}

export function looksLikeCalendarClarificationFollowUp(text: string) {
  const normalized = normalizeWhitespace(text);
  return CALENDAR_NOUN_PATTERN.test(normalized) || CALENDAR_DATE_TIME_PATTERN.test(normalized);
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function buildIsoLocalString(year: number, month: number, day: number, hours: number, minutes: number) {
  const paddedMonth = String(month).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  const paddedHours = String(hours).padStart(2, "0");
  const paddedMinutes = String(minutes).padStart(2, "0");

  return `${year}-${paddedMonth}-${paddedDay}T${paddedHours}:${paddedMinutes}:00`;
}

function addMinutesToIsoString(isoString: string, minutesToAdd: number) {
  const startDate = new Date(isoString);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  startDate.setMinutes(startDate.getMinutes() + minutesToAdd);
  const year = startDate.getFullYear();
  const month = startDate.getMonth() + 1;
  const day = startDate.getDate();
  const hours = startDate.getHours();
  const minutes = startDate.getMinutes();

  return buildIsoLocalString(year, month, day, hours, minutes);
}

function getTimeZoneDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value || "0"),
    month: Number(parts.find((part) => part.type === "month")?.value || "0"),
    day: Number(parts.find((part) => part.type === "day")?.value || "0"),
    hours: Number(parts.find((part) => part.type === "hour")?.value || "0"),
    minutes: Number(parts.find((part) => part.type === "minute")?.value || "0"),
  };
}

function addDaysToParts(parts: { year: number; month: number; day: number }, days: number) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function inferHourWithContext(rawHours: number, meridiem: string | undefined, normalized: string, nowHours: number) {
  const hours = rawHours;

  if (meridiem === "pm" && hours < 12) {
    return hours + 12;
  }

  if (meridiem === "am" && hours === 12) {
    return 0;
  }

  if (meridiem) {
    return hours;
  }

  const suggestsEvening = /\b(later today|tonight|this evening|evening|after work)\b/i.test(normalized);
  const suggestsAfternoon = /\b(this afternoon|afternoon)\b/i.test(normalized);
  const suggestsMorning = /\b(this morning|morning)\b/i.test(normalized);

  if (suggestsEvening && hours < 12) {
    return hours + 12;
  }

  if (suggestsAfternoon && hours < 12) {
    return hours === 12 ? hours : hours + 12;
  }

  if (suggestsMorning && hours === 12) {
    return 0;
  }

  if (/\b(later today|today)\b/i.test(normalized) && hours < 12 && hours <= nowHours) {
    return hours + 12;
  }

  return hours;
}

function extractHeuristicTitle(message: string) {
  const normalized = normalizeWhitespace(message);
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
    if (match?.[1]) {
      const title = match[1]
        .replace(/^(?:a|an|the|my)\s+/i, "")
        .replace(/^on\s+my\s+calend(?:a|e)r\s+to\s+/i, "")
        .replace(/\s+(?:please|pls)$/i, "")
        .trim();
      if (title) {
        return title.charAt(0).toUpperCase() + title.slice(1);
      }
    }
  }

  return "Reminder";
}

function parseExplicitDateTimeIntent(message: string, timeZone: string, nowIso: string): ParsedCalendarIntent | null {
  const normalized = normalizeWhitespace(message);
  const dateMatch = normalized.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  const timeMatch = normalized.match(/\b(?:at|around)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  const nowParts = getTimeZoneDateParts(new Date(nowIso), timeZone);

  let resolvedDate: { year: number; month: number; day: number } | null = null;

  if (dateMatch) {
    const month = Number(dateMatch[1]);
    const day = Number(dateMatch[2]);
    const rawYear = Number(dateMatch[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    resolvedDate = { year, month, day };
  } else if (/\btomorrow\b/i.test(normalized)) {
    resolvedDate = addDaysToParts(nowParts, 1);
  } else if (/\b(today|later today|tonight|this morning|this afternoon|this evening)\b/i.test(normalized)) {
    resolvedDate = {
      year: nowParts.year,
      month: nowParts.month,
      day: nowParts.day,
    };
  }

  if (!resolvedDate) {
    return null;
  }

  if (!timeMatch) {
    return {
      intent: "create_event",
      needsClarification: true,
      missingFields: ["time"],
      clarificationQuestion: "What time should I use for that reminder?",
    };
  }

  const month = resolvedDate.month;
  const day = resolvedDate.day;
  const year = resolvedDate.year;

  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2] || "0");
  const meridiem = timeMatch[3]?.toLowerCase();
  hours = inferHourWithContext(hours, meridiem, normalized, nowParts.hours);

  if (
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(year) ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const startIso = buildIsoLocalString(year, month, day, hours, minutes);
  const endIso = addMinutesToIsoString(startIso, 60);

  if (!endIso) {
    return null;
  }

  return {
    intent: "create_event",
    needsClarification: false,
    event: {
      title: extractHeuristicTitle(normalized),
      description: null,
      location: null,
      startIso,
      endIso,
      timeZone,
    },
  };
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
  const heuristicResult = parseExplicitDateTimeIntent(params.message, params.timeZone, params.nowIso);

  try {
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

    const parsed = extractJsonObject(content) as ParsedCalendarIntent;
    if ((parsed.intent !== "create_event" || parsed.needsClarification || !parsed.event) && heuristicResult) {
      return heuristicResult;
    }

    return parsed;
  } catch (error) {
    if (heuristicResult) {
      return heuristicResult;
    }

    throw error;
  }
}