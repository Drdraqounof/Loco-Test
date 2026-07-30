// In plain terms: shared types for the chat orchestration pipeline.

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OpenAIChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: "json_object" };
}

export interface PipelineReviewResult {
  approved: boolean;
  matchesUserRequest: boolean;
  worksLikely: boolean;
  updatedUserQuery: string;
  reviewerNotes: string;
  fixes: string[];
}
