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
  voice: string
): Promise<FetchResponse<{ message: string; audio?: string }>> {
  return fetchWithRetry("/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      voice,
      language: "javascript",
      topic: "general",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
    timeout: 30000,
    retries: 2,
  });
}
