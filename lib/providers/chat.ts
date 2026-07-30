import { fetchOpenAI, normalizeModelOutput } from "@/lib/orchestration/openaiTransport";
import type { Message, OpenAIChatOptions } from "@/lib/orchestration/types";

// In plain terms: chat provider adapters for OpenAI and Claude used by the main orchestrator.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function callOpenAIChat(messages: Message[], options: OpenAIChatOptions = {}) {
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

export async function callClaudeChat(
  messages: Message[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  if (!CLAUDE_API_KEY) {
    throw new Error("Claude API key not configured");
  }

  const claudeMessages = messages
    .filter((msg) => msg.role !== "system")
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

  const systemMessages = messages
    .filter((msg) => msg.role === "system")
    .map((msg) => msg.content)
    .join("\n\n");

  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: options.maxTokens ?? 1000,
      ...(systemMessages ? { system: systemMessages } : {}),
      messages: claudeMessages,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // Silent failure - will fall back to OpenAI
    throw new Error(
      errorData.error?.message || "Failed to get response from Claude"
    );
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;

  if (!content) {
    throw new Error("No response from Claude");
  }

  return content;
}
