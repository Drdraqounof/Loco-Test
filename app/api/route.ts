import { NextRequest, NextResponse } from "next/server";
import { 
  formatCodeWithLineNumbers, 
  findElements, 
  buildCodeSummary,
  extractLineNumbersFromResponse,
  validateLineNumbers 
} from "@/utils/codeProcessor";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
    if (user && user.id) {
      try {
        // Temporarily store in localStorage instead of database until migration is run
        const storageKey = `chat_history_${user.id}_${topic}`;
        const storedHistory = localStorage.getItem(storageKey);
        
        if (storedHistory) {
          try {
            const pastMessages = JSON.parse(storedHistory);
            const recentMessages = pastMessages.slice(-5); // Get last 5 messages for context
            
            if (recentMessages.length > 0) {
              previousContext = `\nPREVIOUS CONVERSATION CONTEXT:
The student has previously discussed:`;
              recentMessages.forEach((msg: any) => {
                if (msg.role === "user") {
                  previousContext += `\n- "${msg.content.substring(0, 100)}${msg.content.length > 100 ? "..." : ""}"`;
                }
              });
              previousContext += `\nRemember what they've learned and their progress in this conversation.`;
            }
          } catch (e) {
            console.error("Error parsing chat history:", e);
          }
        }
      } catch (error) {
        console.error("Error retrieving chat history:", error);
        // Continue without history if storage fails
      }
    }

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

    const systemPrompt = `You are Loco, a friendly coding assistant that helps students learn, debug, and create code. Keep responses concise and helpful.${userGreeting}${userContext}

YOUR CAPABILITIES:
Help debug existing code
Generate new code from scratch based on user requests
Provide explanations and teaching
Answer coding questions
Suggest best practices

WHEN USER ASKS FOR CODE GENERATION:
1. If the request is ambiguous, ASK CLARIFYING QUESTIONS first:
   What programming language? (JavaScript, Python, TypeScript, etc.)
   What framework? (React, Vue, Django, Flask, etc.) if applicable
   What are the key features/requirements?
   Any specific constraints or preferences?
2. Briefly explain your approach in the chat
3. DO NOT show code in the chat message itself
4. Instead, say: Replace [filename] with the code shown in the terminal
5. Provide all actual code ONLY in code blocks

CRITICAL RULE - DO NOT PUT CODE BLOCKS IN CHAT:
Never use backticks or code blocks in the chat response
Never show any code snippets in the message text
Only mention file names and say use the code shown in the terminal
The code blocks are extracted separately and shown on the right
Keep chat purely for instructions and explanations

CHAT FORMAT EXAMPLE:
Good: Create a new file called game.js and use the code shown in the terminal. Then run $ npm start.
Bad: Here is the code with backticks and code blocks

Terminal commands should still be prefixed with $ (e.g., $ npm install)
Format terminal sections like this:
Code Output
bash
$ command1
$ command2
output here

Do NOT use markdown symbols like # or - in your response
Keep chat messages clean with only text and explanations
Tell users to use the code in the terminal instead of showing code

Remember: Code blocks are shown separately on the right. Your chat is ONLY for instructions!`;

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

    // If audio is requested, call OpenAI TTS API
    if (voice && aiMessage) {
      try {
        const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "tts-1",
            input: aiMessage,
            voice,
            response_format: "base64",
          }),
        });
        if (ttsResponse.ok) {
          const ttsData = await ttsResponse.json();
          audioBase64 = ttsData.audio;
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

    // Add relevant resources based on language or topic
    let enhancedMessage = aiMessage;
    const keywords = aiMessage.toLowerCase();
    
    // Check if the user is asking about a specific language and add relevant resources
    const languageResources = RESOURCES[language as keyof typeof RESOURCES];
    const shouldAddResources = 
      (keywords.includes("learn") || 
       keywords.includes("read") || 
       keywords.includes("resource") || 
       keywords.includes("tutorial") ||
       keywords.includes("documentation") ||
       keywords.includes("more") ||
       keywords.includes("help")) &&
      languageResources;

    if (shouldAddResources && !aiMessage.includes("https://")) {
      enhancedMessage += `\n\nHere are some awesome resources to dive deeper:\n`;
      languageResources.slice(0, 3).forEach((resource) => {
        enhancedMessage += `- ${resource.title}: ${resource.url}\n`;
      });
    }

    // Check for career/learning path questions
    if ((keywords.includes("career") || keywords.includes("learn") || keywords.includes("path")) && !keywords.includes("https://")) {
      const careerResources = RESOURCES.career;
      enhancedMessage += `\n\nCheck out these learning platforms:\n`;
      careerResources.forEach((resource) => {
        enhancedMessage += `- ${resource.title}: ${resource.url}\n`;
      });
    }

    // Save conversation to database for memory if user is logged in
    if (user && user.id) {
      try {
        const conversationMessages = [
          ...messages,
          {
            role: "assistant",
            content: enhancedMessage,
          },
        ];

        // Store in localStorage until Prisma migration is applied
        const storageKey = `chat_history_${user.id}_${topic}`;
        localStorage.setItem(storageKey, JSON.stringify(conversationMessages));
      } catch (error) {
        console.error("Error saving chat history:", error);
      }
    }

    return NextResponse.json({
      success: true,
      message: enhancedMessage,
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
