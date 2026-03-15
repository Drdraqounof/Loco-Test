import type { AttachmentContextItem } from "@/lib/attachmentContext";

interface PreviewRuntimeIssue {
  message: string;
  source: string;
  capturedAt: string;
}

export type AssistantMode = "auto" | "loco" | "claude";
export type ResolvedAssistantMode = "loco" | "claude";
export type AssistantProvider = "openai" | "claude";
export type RoutingAnalysisSource = "user-selected" | "openai-classifier" | "heuristic";
export type WorkflowMode = "classic" | "enhanced";
export type WorkflowTaskType = "coding" | "explanation" | "bug-fix" | "frontend-build" | "backend-api" | "database-schema" | "refactor" | "review";
export type WorkflowFailureReason = "none" | "missing-context" | "logic-issue" | "stack-mismatch" | "incomplete-answer" | "hallucinated-dependency";
export type WorkflowRouteCategory = "coding" | "data" | "conversation";
export type WorkflowPreferredModel = "claude" | "chatgpt" | "gemini";

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
  assistantMode: AssistantMode = "auto",
  experimentalAiWorkflow = false,
): Promise<FetchResponse<{
  message: string;
  audio?: string;
  memoryHit?: boolean;
  memorySources?: string[];
  memoryMatches?: {
    assistantMemories?: Array<{ content: string; kind: string }>;
    conversationMatches?: Array<{ date: string; userText: string; assistantText: string }>;
  };
  routing?: {
    requestedAssistantMode: AssistantMode;
    resolvedAssistantMode: ResolvedAssistantMode;
    provider: AssistantProvider;
    fallbackReason?: string | null;
    analysisSource: RoutingAnalysisSource;
    rationale: string;
    confidence: "low" | "medium" | "high";
  };
  workflow?: {
    enabled: boolean;
    mode: WorkflowMode;
    taskType: WorkflowTaskType;
    classificationSource: "heuristic" | "openai-classifier";
    rationale: string;
    confidence: "low" | "medium" | "high";
    routeCategory: WorkflowRouteCategory;
    preferredModel: WorkflowPreferredModel;
    briefSource: "deterministic" | "model";
    planSource: "deterministic" | "model";
    planSummary: string;
    planSteps: string[];
    suggestedTools: string[];
    executableTools: string[];
    reviewAttemptCount: number;
    missingContext: boolean;
    failureReason: WorkflowFailureReason;
    recommendedContext: string[];
    reviewConfidence: number;
    reviewConfidenceThreshold: number;
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
      assistantMode,
      experimentalAiWorkflow,
      language: "javascript",
      topic: "general",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
    timeout: 90000,
    retries: 0,
  });
}
