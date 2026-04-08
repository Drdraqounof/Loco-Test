import { NextRequest, NextResponse } from "next/server";

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

interface ClaudeRequestBody {
  model: string;
  max_tokens: number;
  system?: string;
  messages: ClaudeMessage[];
}

async function callClaudeAPI(
  messages: ClaudeMessage[],
  systemPrompt?: string
): Promise<string> {
  if (!CLAUDE_API_KEY) {
    throw new Error("Claude API key not configured");
  }

  const body: ClaudeRequestBody = {
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages,
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Claude API error:", errorData);
    throw new Error(
      errorData.error?.message || "Failed to get code from Claude"
    );
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;

  if (!content) {
    throw new Error("No response from Claude");
  }

  return content;
}

export async function POST(request: NextRequest) {
  try {
    if (!CLAUDE_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Claude API key not configured" },
        { status: 500 }
      );
    }

    const {
      prompt,
      context = "",
      language = "javascript",
      previousCode = "",
    } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an expert code generation assistant. Generate clean, production-ready code based on user requirements.

Guidelines:
- Write clear, readable code with proper naming conventions.
- Include comments for complex logic.
- Follow best practices for the requested language.
- If generating multiple functions, organize them logically.
- Include error handling where appropriate.
- Return only the code without markdown formatting or code blocks.`;

    let userMessage = prompt;

    if (previousCode) {
      userMessage += `\n\nPrevious code context:\n\`\`\`${language}\n${previousCode}\n\`\`\``;
    }

    if (context) {
      userMessage = `Context: ${context}\n\n${userMessage}`;
    }

    const messages: ClaudeMessage[] = [
      {
        role: "user",
        content: userMessage,
      },
    ];

    const generatedCode = await callClaudeAPI(messages, systemPrompt);

    return NextResponse.json({
      success: true,
      code: generatedCode,
      model: CLAUDE_MODEL,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Claude code generation error:", message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
