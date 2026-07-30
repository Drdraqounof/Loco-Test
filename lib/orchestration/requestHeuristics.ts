// In plain terms: lightweight text heuristics that classify chat requests before model generation.

import { LIVE_CALENDAR_DELETE_MARKER } from "@/lib/orchestration/calendarConstants";

export function isCancellationReply(text: string) {
  return /^(no|cancel|never mind|dont|don't add it|stop)\b/i.test(text.trim());
}

export function looksLikeReplyDraftRequest(text: string) {
  const normalized = normalizeWhitespace(text);

  if (!normalized) {
    return false;
  }

  const draftingPattern = /\b(how should i respond|how do i respond|help me respond|help me reply|draft(?: me)?(?: a)? reply|draft(?: me)?(?: an)? email|write(?: me)?(?: a)? reply|write(?: me)?(?: an)? email|what should i say|how should i answer|respond to this|reply to this|write back|send back)\b/i;
  const emailThreadPattern = /\b(?:from|to|subject):\b|\b(?:happy monday|looking forward to|let me know what works|availability below|don't hesitate to reach out|cheers,)\b/i;

  return draftingPattern.test(normalized) || (normalized.includes("@") && emailThreadPattern.test(normalized));
}

export function looksLikeCalendarMemoryQuestion(text: string) {
  return /(what|which|show|list|remember|remind me)[\s\S]*(calendar|event|events|meeting|meetings|appointment|appointments|scheduled|schedule)/i.test(
    text.trim()
  );
}

export function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function looksLikeCalendarCreateRequest(text: string) {
  const normalized = normalizeWhitespace(text);
  return /\b(remind(?: me)?(?: to)?|reminder|schedule|add|create|book|set[- ]?up|put|plan)\b/i.test(normalized)
    && /\b(calendar|calender|event|events|appointment|appointments|meeting|meetings|today|tomorrow|tonight|this\s+(?:morning|afternoon|evening|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|around\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i.test(normalized);
}

export function looksLikeLiveCalendarReadRequest(text: string) {
  const normalized = normalizeWhitespace(text);
  if (looksLikeCalendarCreateRequest(normalized)) {
    return false;
  }

  return /(what(?:'s| is)|show|list|tell me|how busy)[\s\S]*(calendar|calender|schedule|agenda|events?)/i.test(normalized)
    || /(calendar|calender|schedule|agenda|events?)[\s\S]*(today|tomorrow|tonight|this\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(normalized);
}

export function looksLikeLiveCalendarDeleteRequest(text: string) {
  const normalized = normalizeWhitespace(text);
  return /(remove|delete|clear|cancel)[\s\S]*(event|events|meeting|meetings|appointment|appointments)/i.test(normalized)
    && /(calendar|calender|schedule|agenda|today|tomorrow|tonight|this\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(normalized);
}

export function previousAssistantAskedLiveDeleteConfirmation(
  messages: Array<{ role: string; content: string }>,
  marker: string = LIVE_CALENDAR_DELETE_MARKER
) {
  const previousAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  return previousAssistant?.content.includes(marker) ?? false;
}

export function getUserMessageBeforeLatestAssistant(messages: Array<{ role: string; content: string }>) {
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

export function isTimeOnlyCalendarReply(text: string) {
  return /^\d{1,2}(?::\d{2})?\s*(?:am|pm)?$/i.test(text.trim());
}

export function looksLikeCodeRequest(text: string): boolean {
  const codeKeywords = [
    /\b(write|generate|create|build|code)\b.*(?:function|method|component|script|class|code|snippet|helper)/i,
    /\b(generate|create|write).*(?:javascript|typescript|python|java|c\+\+|rust|go|php|sql|html|css|react|vue|angular)\b/i,
    /\b(refactor|optimize|fix|debug)\b.*(?:code|function|method|logic)\b/i,
    /\bcode\s(?:for|to|that)/i,
    /(?:how|can you|please)\s+(?:write|create|generate|build).*(?:code|function|component|script)/i,
    /\bfunction\b|\bclass\b|\bcomponent\b|\bhelper\b|\bmodule\b/i,
  ];

  return codeKeywords.some((keyword) => keyword.test(text));
}

export function looksLikeGameRequest(text: string): boolean {
  const gameKeywords = [
    // Game creation
    /\b(create|build|make|write|generate)\b.*\bgame\b/i,
    /\bgame\b.*\b(create|build|make|write|generate)\b/i,
    /\b(shooter|platformer|puzzle|rpg|arcade|retro)\b.*\bgame\b/i,
    /\bgame\b.*\b(shooter|platformer|puzzle|rpg|arcade|retro)\b/i,
    /\b(canvas|html5|webgl)\b.*\bgame\b/i,
    /\bplayable\b.*(?:game|prototype)/i,
    
    // Game modifications and additions
    /\b(add|implement|create|build|make|improve|enhance)\b.*\b(enemies|enemy|boss|wave|level|feature|mechanic|animation|effect|particle|ui|menu)/i,
    /\b(enemies|enemy|boss|waves|levels|mechanics|animations)\b.*\b(to|for|in).*\bgame\b/i,
    /\b(game mechanics|game feature|game element|enemy|boss|wave|level|scoring|health|collision)\b/i,
    /\b(2d|3d|html5|canvas|shooter|platformer|puzzle|arcade)\b/i,
  ];

  return gameKeywords.some((keyword) => keyword.test(text));
}
