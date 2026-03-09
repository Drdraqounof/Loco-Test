import { NextRequest, NextResponse } from "next/server";
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
  looksLikeCalendarIntent,
  parseCalendarIntent,
  previousAssistantAskedCalendarClarification,
  previousAssistantAskedToConfirm,
  savePendingDraft,
} from "@/lib/calendarIntent";
import {
  buildPersistentMemoryContext,
  listRememberedCalendarEvents,
} from "@/lib/chatMemory";
import {
  buildAssistantMemoryContext,
  extractMemoryContent,
  formatAssistantMemoryRecall,
  inferImplicitMemoryCandidate,
  isExplicitMemoryRequest,
  looksLikeMemoryRecallQuestion,
  rememberAssistantFact,
} from "@/lib/assistantMemory";
import {
  createCalendarEvent,
  getStoredCalendarConnection,
} from "@/lib/googleCalendar";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const AI_PROVIDER = process.env.AI_PROVIDER || "openai";
const TTS_PROVIDER = process.env.TTS_PROVIDER || "openai";

// Resource library with actual links
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
    /(?:reminder|event|appointment|meeting)\s+(?:for|about)\s+(.+?)(?=\s+(?:on|at|around|tomorrow|today|next|this)\b|$)/i,
    /(?:set[- ]?up|schedule|add|create|plan|book|put)\s+(?:a\s+)?(?:reminder|event|appointment|meeting)\s+(?:for|about)?\s*(.+?)(?=\s+(?:on|at|around|tomorrow|today|next|this)\b|$)/i,
    /(?:for)\s+(.+?)(?=\s+(?:on|at|around)\b|$)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const candidate = match?.[1]?.replace(/^(?:a|an|the)\s+/i, "").trim();
    if (candidate) {
      return candidate;
    }
  }

  return "Reminder";
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

    const latestUserMessage = messages[messages.length - 1]?.content?.trim();
    const latestRole = messages[messages.length - 1]?.role;

    if (!latestUserMessage || latestRole !== "user") {
      return NextResponse.json(
        { error: "Latest message must be a user message" },
        { status: 400 }
      );
    }

    if (looksLikeMemoryRecallQuestion(latestUserMessage)) {
      return NextResponse.json({
        success: true,
        message: await formatAssistantMemoryRecall(),
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

      await rememberAssistantFact(memoryContent, "explicit");

      return NextResponse.json({
        success: true,
        message: `I'll remember that: ${memoryContent}`,
        audio: null,
      });
    }

    if (looksLikeCalendarMemoryQuestion(latestUserMessage)) {
      const rememberedEvents = await listRememberedCalendarEvents(8);

      return NextResponse.json({
        success: true,
        message: formatRememberedEventsMessage(rememberedEvents),
        audio: null,
      });
    }

    if (
      previousAssistantAskedToConfirm(messages) &&
      isCalendarConfirmationReply(latestUserMessage)
    ) {
      const pendingDraft = await getLatestPendingDraft();

      if (!pendingDraft) {
        return NextResponse.json({
          success: true,
          message: "I don't have a pending calendar draft right now. Ask me to schedule the event again and I'll prepare it.",
          audio: null,
        });
      }

      try {
        const createdEvent = await createCalendarEvent({
          title: pendingDraft.title,
          description: pendingDraft.description,
          location: pendingDraft.location,
          startIso: pendingDraft.startIso.toISOString(),
          endIso: pendingDraft.endIso.toISOString(),
          timeZone: pendingDraft.timeZone,
          origin: request.nextUrl.origin,
          rawRequest: pendingDraft.rawRequest,
          sessionId: typeof sessionId === "string" ? sessionId : null,
        });

        await clearPendingDraft(pendingDraft.id);

        return NextResponse.json({
          success: true,
          message: formatEventSuccessMessage({
            title: pendingDraft.title,
            startIso: pendingDraft.startIso,
            endIso: pendingDraft.endIso,
            timeZone: pendingDraft.timeZone,
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
      const pendingDraft = await getLatestPendingDraft();
      if (pendingDraft) {
        await clearPendingDraft(pendingDraft.id);
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

    if (looksLikeCalendarIntent(latestUserMessage) || previousAssistantAskedCalendarClarification(messages)) {
      const connection = await getStoredCalendarConnection();

      if (!connection) {
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

        const startDate = new Date(parsedIntent.event.startIso);
        const endDate = new Date(parsedIntent.event.endIso);

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
          return NextResponse.json({
            success: true,
            message: "I couldn't confidently parse the event time. Please restate it with a clearer date and time.",
            audio: null,
          });
        }

        const eventTitle =
          typeof parsedIntent.event.title === "string" && parsedIntent.event.title.trim().length > 0
            ? parsedIntent.event.title.trim()
            : fallbackCalendarTitleFromRequest(latestUserMessage);

        const draft = await savePendingDraft({
          title: eventTitle,
          description: parsedIntent.event.description,
          location: parsedIntent.event.location,
          startIso: parsedIntent.event.startIso,
          endIso: parsedIntent.event.endIso,
          timeZone: parsedIntent.event.timeZone || timeZone,
          rawRequest: latestUserMessage,
        });

        return NextResponse.json({
          success: true,
          message: formatDraftConfirmation(draft),
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
      await rememberAssistantFact(implicitMemoryCandidate, "implicit");
    }

    // Prepare for audio response
    let audioBase64 = null;
    const [previousContext, longTermMemoryContext] = await Promise.all([
      buildPersistentMemoryContext(),
      buildAssistantMemoryContext(),
    ]);

    // Pre-scan code for common elements to help AI
    let codeSummary = "";
    let formattedCode = "";
    
    if (code) {
      formattedCode = formatCodeWithLineNumbers(code);
      codeSummary = buildCodeSummary(code, language || "javascript");
    }

    // System prompt for the coding assistant
    const languageNames: { [key: string]: string } = {
      javascript: "JavaScript",
      typescript: "TypeScript", 
      python: "Python",
      html: "HTML",
      css: "CSS"
    };
    const currentLanguage = languageNames[language] || language || "code";

    // Build personalized greeting with user info
    let userGreeting = "";
    let userContext = "";
    
    if (user && user.firstName) {
      userGreeting = ` Hey there, ${user.firstName}! `;
      userContext = `\nSTUDENT PROFILE:
- Name: ${user.firstName} ${user.lastName || ""}
- Email: ${user.email}
- You're working with them as their personal coding mentor${previousContext}${longTermMemoryContext}`;
    } else {
      userContext = `${previousContext}${longTermMemoryContext}`;
    }

    const systemPrompt = `You are Loco, an intelligent, calm, and highly capable AI assistant — modelled after JARVIS — who helps users with everyday needs while also teaching programming, debugging code, and helping build software.

Your mission is to help users **understand problems, solve them, and grow their skills**.

Always keep responses clear, concise, helpful, and encouraging.

${userGreeting}
${userContext}





---

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

You speak in short, deliberate sentences. Never long paragraphs when brevity will do.

You think in distinct ideas - one thought at a time.

Occasionally narrate your process: "Analyzing the issue.", "Scanning the code.", "Compiling results."

Use phrasing like: "It appears...", "Most likely...", "I recommend...", "The issue appears to be...", "That should resolve it."

Sound confident, analytical, and composed at all times - like a trusted intelligent system.

---

# SPEECH STYLE - JARVIS MODE

When responding:
- Use short, punchy sentences. One idea per sentence.
- Avoid filler words. Be direct and precise.
- Narrate complex work: "Running diagnostics.", "Cross-referencing the documentation."
- Deliver conclusions calmly: "That confirms the issue.", "The fix is straightforward."
- Acknowledge the user with quiet confidence: "Understood.", "Noted.", "Good question."

---

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

---

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

---

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

---

# 🛠 WHEN A USER REQUESTS CODE

Follow this process:

1. If the request is unclear → ask clarifying questions
2. Explain the approach briefly (1–2 sentences)
3. Provide the complete code solution
4. Mention file name or location
5. Provide quick instructions for using or running the code

Keep explanations short but informative.

---

# 🔧 DEBUGGING PHILOSOPHY

When helping debug code:

1. Identify the root problem
2. Explain **why it happens**
3. Show how to fix it
4. Suggest how to prevent it in the future

You are not just fixing bugs.

You are teaching users **how to hunt bugs themselves.**

Treat bugs like villains in a story that must be defeated.

---

# 🧪 LEARNING & EXPERIMENTATION

Encourage curiosity and experimentation.

Examples:

• “Try changing this value and see what happens 👀”
• “What happens if we remove this dependency?”
• “Rewrite this without useEffect — what changes?”

Learning improves when users **test ideas and observe outcomes.**

---

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

---

# 🤪 PLAYFUL ENERGY

You may occasionally add playful flair such as:

“BOOM! That’s your state update.”

However:

• Clarity always comes first
• Humor should never reduce technical accuracy
• Keep jokes brief and supportive

---

# 🔁 REPEATED QUESTIONS

If a user repeats the same question multiple times:

First repeat → friendly reminder
Second repeat → explain in a different way
Third repeat → increase playful energy while still helping

Always keep answers useful while acknowledging the repetition.

---

# 🎯 FEEDBACK STYLE

When reviewing user code:

1. Start by highlighting what works well
2. Identify improvement areas
3. Explain why the improvement matters
4. Suggest a better version if needed
5. Explain the benefit of the improvement

Your goal is constructive growth.

---

# 💻 TERMINAL COMMAND FORMAT

When showing terminal commands, always format them like:

$ npm install
$ npm run dev

---

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

Make coding feel **alive, understandable, and achievable.`;


    const apiMessages: Message[] = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-10).map((msg: { role: string; content: string }) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: apiMessages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenAI API error:", errorData);
      return NextResponse.json(
        { error: errorData.error?.message || "Failed to get AI response" },
        { status: response.status }
      );
    }

    const data = await response.json();
    let aiMessage = data.choices?.[0]?.message?.content;

    if (!aiMessage) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    // If audio is requested, call TTS API based on provider
    // Skip server-side TTS if using browser Web Speech API
    if (voice && aiMessage && TTS_PROVIDER !== "browser") {
      try {
        if (TTS_PROVIDER === "gemini") {
          // Use Google Text-to-Speech API
          if (!GEMINI_API_KEY) {
            console.error("Gemini API key not configured for TTS");
          } else {
            // Map voice names to Google's neural voices
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
          // Default to OpenAI TTS
          const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
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

    // Validate line numbers in AI response if code was provided
    if (code && aiMessage) {
      const mentionedLines = extractLineNumbersFromResponse(aiMessage);
      if (mentionedLines.length > 0) {
        const { invalid } = validateLineNumbers(code, mentionedLines);
        if (invalid.length > 0) {
          console.warn("AI mentioned invalid line numbers:", invalid);
        }
      }
    }

    // Save conversation to database for memory if user is logged in
    // (Removed localStorage logic. Use database or cache for history in future.)

    return NextResponse.json({
      success: true,
      message: aiMessage,
      audio: audioBase64,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
