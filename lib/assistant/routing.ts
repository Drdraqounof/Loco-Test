// In plain terms: resolves settings assistantMode into the provider the chat route should use.

import { looksLikeCodeRequest, looksLikeGameRequest } from "@/lib/orchestration/requestHeuristics";

export type AssistantMode = "auto" | "loco" | "claude";
export type ResolvedAssistantMode = "loco" | "claude";
export type AssistantProvider = "openai" | "claude";
export type RoutingAnalysisSource = "user-selected" | "heuristic";

export interface AssistantRoutingResult {
  requestedAssistantMode: AssistantMode;
  resolvedAssistantMode: ResolvedAssistantMode;
  provider: AssistantProvider;
  fallbackReason?: string | null;
  analysisSource: RoutingAnalysisSource;
  rationale: string;
  confidence: "low" | "medium" | "high";
}

export function resolveAssistantRouting(input: {
  assistantMode?: AssistantMode | string | null;
  latestUserMessage: string;
  isCodeRequest?: boolean;
  isGameRequest?: boolean;
  claudeAvailable: boolean;
}): AssistantRoutingResult {
  const requested =
    input.assistantMode === "loco" || input.assistantMode === "claude" || input.assistantMode === "auto"
      ? input.assistantMode
      : "auto";

  const isCodeRequest = input.isCodeRequest ?? looksLikeCodeRequest(input.latestUserMessage);
  const isGameRequest = input.isGameRequest ?? looksLikeGameRequest(input.latestUserMessage);

  if (requested === "loco") {
    return {
      requestedAssistantMode: requested,
      resolvedAssistantMode: "loco",
      provider: "openai",
      fallbackReason: null,
      analysisSource: "user-selected",
      rationale: "User selected Loco (OpenAI) mode.",
      confidence: "high",
    };
  }

  if (requested === "claude") {
    if (!input.claudeAvailable) {
      return {
        requestedAssistantMode: requested,
        resolvedAssistantMode: "loco",
        provider: "openai",
        fallbackReason: "claude_unavailable",
        analysisSource: "user-selected",
        rationale: "User selected Claude, but CLAUDE_API_KEY is not configured; falling back to OpenAI.",
        confidence: "high",
      };
    }

    return {
      requestedAssistantMode: requested,
      resolvedAssistantMode: "claude",
      provider: "claude",
      fallbackReason: null,
      analysisSource: "user-selected",
      rationale: "User selected Claude mode.",
      confidence: "high",
    };
  }

  // auto: prefer Claude for code/game when available, otherwise Loco/OpenAI
  if ((isCodeRequest || isGameRequest) && input.claudeAvailable) {
    return {
      requestedAssistantMode: "auto",
      resolvedAssistantMode: "claude",
      provider: "claude",
      fallbackReason: null,
      analysisSource: "heuristic",
      rationale: isGameRequest
        ? "Auto mode routed a game request to Claude."
        : "Auto mode routed a code request to Claude.",
      confidence: "medium",
    };
  }

  return {
    requestedAssistantMode: "auto",
    resolvedAssistantMode: "loco",
    provider: "openai",
    fallbackReason: null,
    analysisSource: "heuristic",
    rationale: "Auto mode kept the request on Loco (OpenAI).",
    confidence: "medium",
  };
}
