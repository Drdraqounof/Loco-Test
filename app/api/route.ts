import { NextRequest, NextResponse } from "next/server";

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
import { assembleStatelessAiContext } from "@/lib/ai/context";
import { getPrompt } from "@/lib/ai/prompts";
import { logAiInteraction } from "@/lib/ai/logging";
import { MemoryFactSchema, validateWithSchema } from "@/lib/ai/validation";
import { loadGameExamples, formatGameExamplesForContext } from "@/lib/gameExamples";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const LIVE_CALENDAR_DELETE_MARKER = "Google Calendar delete confirmation ready.";

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
      assistantMode = "auto",
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

      const memoryValidation = validateWithSchema(MemoryFactSchema, { content: memoryContent, kind: "explicit" });
      if (!memoryValidation.ok) {
        return NextResponse.json({
          success: true,
          message: `I couldn't save that memory: ${memoryValidation.issues.join("; ")}`,
          audio: null,
          validation: memoryValidation,
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
      previousAssistantAskedLiveDeleteConfirmation(messages, LIVE_CALENDAR_DELETE_MARKER) &&
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
      previousAssistantAskedLiveDeleteConfirmation(messages, LIVE_CALENDAR_DELETE_MARKER) &&
      isCancellationReply(latestUserMessage)
    ) {
      return NextResponse.json({
        success: true,
        message: "Understood. I kept those Google Calendar events unchanged.",
        audio: null,
      });
    }

    const isReplyDraftRequest = looksLikeReplyDraftRequest(latestUserMessage);
    const isGameRequest = looksLikeGameRequest(latestUserMessage);
    const isCodeRequest = looksLikeCodeRequest(latestUserMessage);

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

    const previousCalendarRequest = getUserMessageBeforeLatestAssistant(messages);
    const isCalendarClarificationFollowUp =
      previousAssistantAskedCalendarClarification(messages) &&
      looksLikeCalendarClarificationFollowUp(latestUserMessage);
    const calendarIntentMessage = isCalendarClarificationFollowUp
      ? mergeCalendarClarificationReply(previousCalendarRequest, latestUserMessage)
      : latestUserMessage;

    if ((!isReplyDraftRequest && looksLikeCalendarIntent(latestUserMessage) && !isGameRequest) || isCalendarClarificationFollowUp) {
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
          message: calendarIntentMessage,
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

        // Check if the requested time has already passed
        const now = new Date();
        if (startDate <= now) {
          const eventTitle =
            typeof event.title === "string" && event.title.trim().length > 0 && event.title.trim().toLowerCase() !== "reminder"
              ? event.title.trim()
              : fallbackCalendarTitleFromRequest(calendarIntentMessage);

          // Option 1: If it's still "today", suggest a time later today (1 hour from now)
          const startOfTomorrow = new Date(now);
          startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
          startOfTomorrow.setHours(0, 0, 0, 0);

          if (startDate.getTime() === new Date(startDate).setHours(0, 0, 0, 0) || startDate.getDate() === now.getDate()) {
            // Suggested time: 1 hour from now, or end of business day if too late
            let suggestedTime = new Date(now);
            suggestedTime.setHours(suggestedTime.getHours() + 1, 0, 0, 0);

            // If suggested time is after 6 PM, suggest tomorrow morning at original time instead
            if (suggestedTime.getHours() >= 18) {
              const tomorrowAtSameTime = new Date(startDate);
              tomorrowAtSameTime.setDate(tomorrowAtSameTime.getDate() + 1);

              const timeFormatter = new Intl.DateTimeFormat("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone,
              });

              const originalTimeStr = timeFormatter.format(startDate);
              const tomorrowTimeStr = timeFormatter.format(tomorrowAtSameTime);

              return NextResponse.json({
                success: true,
                message: `That time (${originalTimeStr}) has already passed today. Would you like me to schedule "${eventTitle}" for tomorrow at that time instead (${tomorrowTimeStr})? Or tell me a different time.`,
                audio: null,
              });
            }

            const timeFormatter = new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              minute: "2-digit",
              timeZone,
            });

            const originalTimeStr = timeFormatter.format(startDate);
            const suggestedTimeStr = timeFormatter.format(suggestedTime);

            return NextResponse.json({
              success: true,
              message: `That time (${originalTimeStr}) has already passed today. Would you like me to schedule "${eventTitle}" for today at ${suggestedTimeStr} instead? Or tell me a different time.`,
              audio: null,
            });
          }

          // If it's a past date, suggest tomorrow at the same time
          const tomorrowAtSameTime = new Date(startDate);
          tomorrowAtSameTime.setDate(tomorrowAtSameTime.getDate() + 1);

          const timeFormatter = new Intl.DateTimeFormat("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone,
          });

          const originalTimeStr = timeFormatter.format(startDate);
          const tomorrowTimeStr = timeFormatter.format(tomorrowAtSameTime);

          return NextResponse.json({
            success: true,
            message: `That time (${originalTimeStr}) has already passed. Would you like me to schedule "${eventTitle}" for tomorrow at that time instead (${tomorrowTimeStr})? Or tell me a different time.`,
            audio: null,
          });
        }

        const eventTitle =
          typeof event.title === "string" && event.title.trim().length > 0 && event.title.trim().toLowerCase() !== "reminder"
            ? event.title.trim()
            : fallbackCalendarTitleFromRequest(calendarIntentMessage);

        const draft = await withOptionalPersistence(
          "Pending calendar draft save",
          () => savePendingDraft({
            title: eventTitle,
            description: event.description,
            location: event.location,
            startIso: event.startIso,
            endIso: event.endIso,
            timeZone: event.timeZone || timeZone,
            rawRequest: calendarIntentMessage,
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

    const aiContext = await assembleStatelessAiContext({
      promptName: "loco-system",
      userGreeting,
      userContext,
      includeSchema: true,
      includeRules: true,
      includeToolSnapshots: true,
    });
    const systemPrompt = aiContext.systemPrompt;

    const recentMessages = messages.slice(-10).map((msg: { role: string; content: string }, index: number, source: Array<{ role: string; content: string }>) => {
      const isLatestUserMessage = index === source.length - 1 && msg.role === "user";
      
      let messageContent = isLatestUserMessage && attachmentContext
        ? `${msg.content}\n\n${attachmentContext}`
        : msg.content;
      
      return {
        role: msg.role as "user" | "assistant",
        content: messageContent,
      };
    });

    const shouldGeneratePlanetTour = looksLikePlanetTourRequest(latestUserMessage);

    // Build system prompt based on request type
    let finalSystemPrompt = systemPrompt;

    if (isGameRequest) {
      // For game requests, use ONLY the copy template - NO OTHER CONTEXT
      const gameExamples = loadGameExamples();
      const gameExamplesContext = formatGameExamplesForContext(gameExamples);

      if (gameExamplesContext) {
        // Game request: ONLY the copy instructions, nothing else
        finalSystemPrompt = gameExamplesContext;
      }
    } else if (isCodeRequest) {
      // For code requests (non-game), still use game examples but keep Loco persona
      const gameExamples = loadGameExamples();
      const gameExamplesContext = formatGameExamplesForContext(gameExamples);

      if (gameExamplesContext) {
        finalSystemPrompt = `${gameExamplesContext}\n\n${systemPrompt}`;
      }
    }

    if (shouldGeneratePlanetTour) {
      const planetTourPrompt = await getPrompt("planet-tour");
      finalSystemPrompt = `${finalSystemPrompt}\n\n${planetTourPrompt.content}`;
    }

    const apiMessages: Message[] = [
      { role: "system", content: finalSystemPrompt },
      ...(previewRuntimeIssueContext ? [{ role: "system" as const, content: previewRuntimeIssueContext }] : []),
      ...recentMessages,
    ];

    const generationStartedAt = Date.now();
    const routing = resolveAssistantRouting({
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
    }

    // Skip review for game requests - just return the copied template
    let pipelineReview = isGameRequest ? {
      approved: true,
      matchesUserRequest: true,
      worksLikely: true,
      confidence: 1,
      updatedUserQuery: latestUserMessage,
      reviewerNotes: "Game copy - no review needed",
      fixes: [],
    } : await reviewLocoResponse({
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

      if (useClaude) {
        try {
          aiMessage = await callClaudeChat(
            [
              ...apiMessages,
              { role: "assistant", content: aiMessage },
              { role: "system", content: revisionInstruction },
            ],
            {
              temperature: 0.35,
              maxTokens: 1200,
            }
          );
        } catch (claudeError) {
          console.warn("Claude API failed during revision, falling back to OpenAI:", claudeError);
          aiMessage = await callOpenAIChat(
            [
              ...apiMessages,
              { role: "assistant", content: aiMessage },
              { role: "system", content: revisionInstruction },
            ],
            {
              temperature: 0.35,
              maxTokens: 1200,
            }
          );
        }
      } else {
        aiMessage = await callOpenAIChat(
          [
            ...apiMessages,
            { role: "assistant", content: aiMessage },
            { role: "system", content: revisionInstruction },
          ],
          {
            temperature: 0.35,
            maxTokens: 1200,
          }
        );
      }

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

    const audioFromProvider = await synthesizeSpeech(aiMessage, voice);
    if (audioFromProvider) {
      audioBase64 = audioFromProvider;
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

    await logAiInteraction({
      model: (routingFallbackReason ? "openai" : routing.provider) === "claude"
        ? "claude-3-5-sonnet-20241022"
        : (process.env.OPENAI_MODEL || "gpt-4o-mini"),
      promptName: aiContext.promptName,
      promptVersion: aiContext.promptVersion,
      schemaVersion: aiContext.schemaVersion,
      rulesVersion: aiContext.rulesVersion,
      temperature: tokenConfig.temperature,
      userInput: latestUserMessage,
      aiOutput: aiMessage,
      validationResult: pipelineReview.approved ? "approved" : "needs_revision",
      routingProvider: routingFallbackReason ? "openai" : routing.provider,
      executionTimeMs: Date.now() - generationStartedAt,
      success: true,
      metadata: {
        routing,
        pipeline: {
          approved: pipelineReview.approved,
          matchesUserRequest: pipelineReview.matchesUserRequest,
          worksLikely: pipelineReview.worksLikely,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: aiMessage,
      audio: audioBase64,
      memoryHit,
      memorySources,
      memoryMatches,
      ai: {
        promptName: aiContext.promptName,
        promptVersion: aiContext.promptVersion,
        schemaVersion: aiContext.schemaVersion,
        rulesVersion: aiContext.rulesVersion,
      },
      routing: {
        requestedAssistantMode: routing.requestedAssistantMode,
        resolvedAssistantMode: routing.resolvedAssistantMode,
        provider: routingFallbackReason ? "openai" : routing.provider,
        fallbackReason: routingFallbackReason,
        analysisSource: routing.analysisSource,
        rationale: routing.rationale,
        confidence: routing.confidence,
      },
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

