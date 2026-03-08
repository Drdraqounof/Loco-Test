import { NextRequest, NextResponse } from "next/server";
import { 
  formatCodeWithLineNumbers, 
  findElements, 
  buildCodeSummary,
  extractLineNumbersFromResponse,
  validateLineNumbers 
} from "@/tools/hooks/utils/codeProcessor";

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

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const { messages, code, language, user, topic = "general", voice = "alloy" } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages are required" },
        { status: 400 }
      );
    }

    // Prepare for audio response
    let audioBase64 = null;
    // Retrieve conversation history from database if user is logged in
    let previousContext = "";
    // (Removed localStorage logic. Use database or cache for history in future.)

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
- You're working with them as their personal coding mentor${previousContext}`;
    } else {
      userContext = previousContext;
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
