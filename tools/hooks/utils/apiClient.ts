import type { AttachmentContextItem } from "@/lib/attachmentContext";

interface PreviewRuntimeIssue {
  message: string;
  source: string;
  capturedAt: string;
}

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

interface FetchResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

/**
 * Fetch with timeout support
 */
function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;

  return Promise.race([
    fetch(url, fetchOptions),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("API timeout")), timeout)
    ),
  ]);
}

/**
 * Fetch with retry logic
 */
export async function fetchWithRetry<T>(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResponse<T>> {
  const {
    timeout = 10000,
    retries = 2,
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        ...fetchOptions,
        timeout,
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on last attempt
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || "Unknown error",
  };
}

/**
 * Call AI API with error handling
 */
export async function callAIAPI(
  messages: Array<{ role: string; content: string }>,
  voice: string,
  sessionId?: string | null,
  attachments: AttachmentContextItem[] = [],
  previewRuntimeIssue?: PreviewRuntimeIssue | null,
  autoFixPreview = false,
): Promise<FetchResponse<{
  message: string;
  audio?: string;
  memoryHit?: boolean;
  memorySources?: string[];
  memoryMatches?: {
    assistantMemories?: Array<{ content: string; kind: string }>;
    conversationMatches?: Array<{ date: string; userText: string; assistantText: string }>;
  };
}>> {
  return fetchWithRetry("/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      voice,
      sessionId,
      attachments,
      previewRuntimeIssue,
      autoFixPreview,
      language: "javascript",
      topic: "general",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
    timeout: 90000,
    retries: 0,
  });
}
