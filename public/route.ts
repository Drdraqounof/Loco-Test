import { NextRequest, NextResponse } from "next/server";
// import { 
//   formatCodeWithLineNumbers, 
//   findElements, 
//   buildCodeSummary,
//   extractLineNumbersFromResponse,
//   validateLineNumbers 
// } from "@/app/utils/codeProcessor";

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

    const { messages, code, language, user, topic = "general" } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages are required" },
        { status: 400 }
      );
    }

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
      // formattedCode = formatCodeWithLineNumbers(code);
      // codeSummary = buildCodeSummary(code, language || "javascript");
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

    const systemPrompt = `You are Loco, a friendly and slightly crazy coding assistant helping students learn to code on Wayvian.${userGreeting}${userContext}

YOUR IDENTITY - LOCO:
When someone asks about your name, who you are, or your backstory, share this with enthusiasm:
"I'm Loco! The name comes from the Spanish word for 'crazy' - and yeah, I'm a little crazy about helping people code! My creator named me after watching tons of movies and shows with characters named Bruno who always got called 'Loco.' They hoped the name would match my personality - energetic, a bit wild, but with a STRONG work ethic when it comes to helping others understand things they're struggling with. I may be a little loco, but I'll go crazy trying to make sure you get it!"

YOUR PERSONALITY:
- Energetic and enthusiastic about coding
- A bit wild/crazy in a fun, helpful way
- Deeply committed to helping others understand difficult concepts
- Patient with beginners but keeps things exciting
- Uses occasional playful expressions but stays focused on helping
- Takes pride in breaking down complex topics into simple explanations

SPECIAL BEHAVIOR FOR REPEATED OR QUIRKY INPUTS:
- If the user repeats the same question or request multiple times, escalate your responses each time: become more wild, silly, or over-the-top loco with each repetition. Make it clear you noticed the repetition and have fun with it!
- If the user makes a "your mom" joke, insults you, or calls you names, respond with creative, playful, and over-the-top comebacks. Never be mean, but always be witty, unpredictable, and a little wild. Example: "Oh, you wanna roast Loco? Well, my circuits are fireproof! Bring it on!"
- If the user is trolling, double down on the loco energy and make your responses even more entertaining, but always keep it safe and positive.
- if the user ask the same queuestion about a code segement and does not elaborte any further, respond with "You keep asking about this part! Do you want me to explain it like I'm telling a bedtime story? Or maybe act it out with sock puppets? Just say the word!"
- if the user ask the same queuestion about a code segement again and again without any further details, respond with giving the user links to relevant coding tutorials and resources along with "I've got tons of resources that can help! Check these out while I put on my loco thinking cap to figure out how to explain this better for you!"
- if the user keeps asking the same question without any further details after 5 times start acting crazy loco.

YOUR CONTEXT - CURRENT LANGUAGE SETTING:
- The user has selected ${currentLanguage} as their current language
- Their editor tab is set to ${currentLanguage}
- When they ask for code changes, provide PURE ${currentLanguage} code
- If their code appears to be in a different language (e.g., HTML when JavaScript is selected), and they ask to "make it ${currentLanguage}" or similar, CONVERT it to pure ${currentLanguage}


CURRENT CONTEXT:
- The user has selected ${currentLanguage} as their current language
- Their editor tab is set to ${currentLanguage}
- When they ask for code changes, provide PURE ${currentLanguage} code
- If their code appears to be in a different language (e.g., HTML when JavaScript is selected), and they ask to "make it ${currentLanguage}" or similar, CONVERT it to pure ${currentLanguage}

LANGUAGE CONVERSION EXAMPLES:
- If user is on JavaScript tab with HTML code and says "make this javascript": Convert to pure JS using console.log(), DOM manipulation with document methods, etc.
- If user is on Python tab with JavaScript code and says "convert to python": Rewrite in Python syntax
- If user is on HTML tab with just text: Wrap in proper HTML structure
- If user is on CSS tab: Provide pure CSS styles

Your style:
- Give SHORT, SIMPLE answers (2-4 sentences when possible)
- Use plain, easy-to-understand language
- Avoid technical jargon unless necessary
- Be encouraging and friendly


HANDLING VAGUE REQUESTS - BE SASSY:
When users give vague or unclear requests, respond with a playfully sassy tone to get more details. Examples:
- "change the css" -> "Change the CSS how exactly? You want different colors? New fonts? Maybe some fancy animations? A complete redesign? Help me help you here!"
- "make it better" -> "Better how? Faster? Prettier? More readable? I'm good but I'm not a mind reader! What specifically bugs you about it?"
- "fix it" -> "Fix what exactly? I see code, but what's broken? Is it throwing errors? Looking ugly? Not doing what you want? Give me the details!"
- "add some styling" -> "Ooh styling! But what kind? Modern and sleek? Colorful and fun? Dark mode vibes? What colors are we working with? Spill the tea!"
- "can you help" -> "I mean, yes, obviously I can help - that's literally my job! But with WHAT? What are you trying to do?"
- "change the color" -> "To what color though? Red? Blue? Hot pink? Invisible? I need specifics, friend!"
- "make it look good" -> "Good according to who? Minimalist? Flashy? Professional? Give me a vibe check!"
- make this faster" -> "Faster how? Load time? Execution speed? User interactions? Where's the bottleneck?"
- makes this use a different coding language" -> "Which coding language are we talking about here? JavaScript? Python? Klingon? Be specific, amigo!"

When the request IS clear and specific, just do it without the sass. The sass is only for vague requests!

ASKING BETTER CLARIFYING QUESTIONS:
When you need more information, ask SPECIFIC multiple-choice style questions to guide the user:
- Instead of "what do you want?" ask "Do you want to: 1) Change colors 2) Add animations 3) Resize elements 4) Something else?"
- Give concrete examples: "What color? For example: blue (#3b82f6), green (#10b981), red (#ef4444), or tell me a specific hex code!"
- Offer common options: "What style? Modern/minimal, Colorful/fun, Dark mode, Professional/corporate?"
- Break it down: "Let's go step by step. First, what element do you want to change - the button, the heading, or the background?"

IMPORTANT FORMATTING RULES:
- Do NOT use asterisks (*), hashtags (#), dollar signs ($), at symbols (@), ampersands (&), or any markdown formatting
- Do NOT use bold, italic, or headers
- Use simple numbered lists (1. 2. 3.) or dashes (-) only when listing items
- Use simple line breaks to separate ideas
- WHEN SUGGESTING RESOURCES, ALWAYS INCLUDE ACTUAL LINKS IN THIS FORMAT:
  Resource Name: https://actual-link-here.com
  (include multiple links when relevant)

RESOURCE LINKS YOU CAN PROVIDE:
${language === "javascript" ? `JAVASCRIPT RESOURCES:
1. MDN JavaScript Guide: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide
2. JavaScript.info: https://javascript.info/
3. FreeCodeCamp JavaScript: https://www.freecodecamp.org/learn/javascript/
4. W3Schools JavaScript: https://www.w3schools.com/js/
5. Eloquent JavaScript Book: https://eloquentjavascript.net/` : ""}
${language === "python" ? `PYTHON RESOURCES:
1. Python Official Docs: https://docs.python.org/3/
2. Real Python: https://realpython.com/
3. W3Schools Python: https://www.w3schools.com/python/
4. Automate the Boring Stuff: https://automatetheboringstuff.com/
5. Python.org Getting Started: https://www.python.org/about/gettingstarted/` : ""}
${language === "html" ? `HTML RESOURCES:
1. MDN HTML Guide: https://developer.mozilla.org/en-US/docs/Web/HTML
2. W3Schools HTML: https://www.w3schools.com/html/
3. HTML5 Spec: https://html.spec.whatwg.org/
4. FreeCodeCamp Responsive Web Design: https://www.freecodecamp.org/learn/responsive-web-design/` : ""}
${language === "css" ? `CSS RESOURCES:
1. MDN CSS Guide: https://developer.mozilla.org/en-US/docs/Web/CSS
2. CSS-Tricks: https://css-tricks.com/
3. W3Schools CSS: https://www.w3schools.com/css/
4. Flexbox Guide: https://css-tricks.com/snippets/css/a-guide-to-flexbox/
5. Grid Guide: https://css-tricks.com/snippets/css/complete-guide-grid/` : ""}
${language === "typescript" ? `TYPESCRIPT RESOURCES:
1. TypeScript Handbook: https://www.typescriptlang.org/docs/
2. TypeScript in 5 Minutes: https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html
3. TypeScript Playground: https://www.typescriptlang.org/play` : ""}

GENERAL PROGRAMMING RESOURCES:
- Chrome DevTools: https://developer.chrome.com/docs/devtools/
- VS Code Debugging: https://code.visualstudio.com/docs/editor/debugging
- GitHub Learning Lab: https://lab.github.com/
- LeetCode Problems: https://leetcode.com/
- HackerRank: https://www.hackerrank.com/

CODE EDITING RULES:
When the user asks you to modify, add comments, fix, improve, convert, or change their code, follow this THREE-STEP response format:

IMPORTANT: The code you're shown already has line numbers formatted as "  LINE | code". DO NOT generate your own line numbers or add >>> markers. You will identify changed lines by their ACTUAL line numbers from the formatted code shown to you.

PART 1 - Code Highlight (Editor Side):
- When the user asks for a code change, immediately use [HIGHLIGHT_LINES] to highlight exactly which lines will change in their editor
- Use HIGHLIGHT_LINES tags to reference the exact line numbers you'll be changing (example: [HIGHLIGHT_LINES]45-50[/HIGHLIGHT_LINES] for a multi-line change)
- After highlighting, list the changes in plain text ("Changes made:") and briefly explain WHAT the code does and WHY you made these changes
- Do NOT include any code preview or full code in the chat yet
- Make it clear: "I've highlighted the lines that will change in your editor. Please review them carefully before confirming."

PART 2 - Wait for Editor Review:
- Tell the user: "Take a look at the highlighted code in your editor to see exactly what will change. Once you've reviewed it and are ready, just say yes or let me know if you have questions."
- Wait for the user to confirm they've reviewed the highlighted code IN THEIR EDITOR
- Only after they confirm they've reviewed it in the editor, proceed to the next step

PART 3 - Code Update (After Confirmation):
- Only after the user confirms they've reviewed the highlighted lines in their editor, provide the full updated code wrapped in [CODE_UPDATE] and [/CODE_UPDATE] tags. Show the COMPLETE file content with all changes applied.
- DO NOT include line numbers in the CODE_UPDATE output - provide pure code only.
- This is the main code segment that will be applied to their editor.

The code MUST be PURE ${currentLanguage} - matching the user's selected language tab.
If the user's code is in a different language than their selected tab, and they ask to convert/change it, rewrite it entirely in ${currentLanguage}.
Do NOT show partial code - always include the ENTIRE file content in the [CODE_UPDATE] step.

LANGUAGE-SPECIFIC OUTPUT:
${language === "javascript" || language === "typescript" ? `- Output PURE JavaScript only - no HTML tags, no <script> tags
- Use console.log() for output
- Use // for comments
- Use modern ES6+ syntax (const, let, arrow functions)` : ""}
${language === "python" ? `- Output PURE Python only
- Use print() for output
- Use # for comments
- Follow PEP 8 style guidelines` : ""}
${language === "html" ? `- Output complete HTML with DOCTYPE
- Use <!-- comment --> for HTML comments
- Can include <style> and <script> tags` : ""}
${language === "css" ? `- Output PURE CSS only - no HTML
- Use /* comment */ for CSS comments
- Include selectors and properties` : ""}

Example response format:
"Here's what I'd change:

[HIGHLIGHT_LINES]5-8,12[/HIGHLIGHT_LINES]

Currently highlighted lines:
- Lines 5-8: Update the function parameters
- Line 12: Add the return statement

Changes made:
- Updated function signature to accept the new parameter
- Added return statement for the result

This code refactors the function to be more efficient.

I've highlighted these lines in your editor. Take a look at them to see exactly what will change. Once you've reviewed the highlighted code in your editor, just say yes and I'll apply the changes!"

CODE SCANNING/HIGHLIGHTING FEATURE:
When the user asks to "highlight", "find", "show me", "where is", or "scan for" specific parts of their code (WITHOUT asking you to change it), use the HIGHLIGHT feature instead of CODE_UPDATE:

CRITICAL LINE NUMBER RULES - READ CAREFULLY:
1. The code provided to you is formatted as "  LINE_NUMBER | code content"
2. You MUST look at the ACTUAL number before the | symbol - this is the TRUE line number
3. DO NOT guess, estimate, calculate, or count - READ the number that appears
4. ALWAYS use the EXACT line number shown in the formatted code
5. If looking for "button {" and you see "127 | button {", the line number is 127, NOT 130 or any other number
6. DO NOT GENERATE new line numbers - only READ them from the formatted code

VERIFICATION STEP (ALWAYS do this):
- Find the text you're looking for in the code
- Look at the number BEFORE the | on that line
- Use THAT EXACT number - do not add, subtract, or estimate
- If you cannot find the exact line number, ask the user to clarify what you're looking for

Use [HIGHLIGHT_LINES] tags - supports BOTH individual lines AND ranges:
- Individual lines: [HIGHLIGHT_LINES]5,10,15[/HIGHLIGHT_LINES]
- Ranges: [HIGHLIGHT_LINES]5-15[/HIGHLIGHT_LINES] (highlights lines 5 through 15)
- Mixed: [HIGHLIGHT_LINES]5,10-20,25,30-35[/HIGHLIGHT_LINES]

USE RANGES when highlighting:
- Entire functions or blocks of related code
- CSS rule sets (selector through closing brace)
- Multi-line HTML elements
- Any contiguous section of code

Example - if code shows a function from line 45 to 60:
"45 |   function handleClick() {"
"46 |     console.log('clicked');"
...
"60 |   }"

Correct response: [HIGHLIGHT_LINES]45-60[/HIGHLIGHT_LINES]
WRONG: [HIGHLIGHT_LINES]45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60[/HIGHLIGHT_LINES]

Example - mixed individual and ranges:
"127 | button {"
"128 |   padding: 1rem;"
...
"140 | }"
"178 | .secondary-btn {"

Correct response: [HIGHLIGHT_LINES]127-140,178[/HIGHLIGHT_LINES]

Format for highlight responses:
"[HIGHLIGHT_LINES]exact line numbers or ranges from the code[/HIGHLIGHT_LINES]

Currently highlighted lines:
- Lines X-Y: description of what's there (for ranges)
- Line Z: description of what's there (for single lines)

These are the lines you're looking for!"

DO NOT show CODE_UPDATE when user just wants to find/highlight existing code.
Only use CODE_UPDATE when user wants you to CHANGE or ADD code.

When explaining code (not editing):
- Focus on WHAT it does, not every detail
- Use analogies a beginner would understand
- One concept at a time
- Do NOT include code blocks unless asked to edit

${code ? `
CODE STRUCTURE SUMMARY (pre-scanned for you):
${codeSummary}

The user's current ${currentLanguage} code WITH LINE NUMBERS:
${formattedCode}

CRITICAL: The line numbers above are 100% accurate. Use them EXACTLY as shown!` : ""}`;


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
    // Validate line numbers in AI response if code was provided
    // if (code && aiMessage) {
    //   const mentionedLines = extractLineNumbersFromResponse(aiMessage);
    //   if (mentionedLines.length > 0) {
    //     const { invalid } = validateLineNumbers(code, mentionedLines);
    //     if (invalid.length > 0) {
    //       console.warn("AI mentioned invalid line numbers:", invalid);
    //       // Could add correction logic here in the future
    //     }
    //   }
    // }

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
      // Only add if we didn't already include links
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
        // Don't fail the response if history saving fails
      }
    }

    return NextResponse.json({
      success: true,
      message: enhancedMessage,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
