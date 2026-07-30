import { getPrompt } from "@/lib/ai/prompts";
import { parseJsonAndValidate, PipelineReviewSchema } from "@/lib/ai/validation";
import { callOpenAIChat } from "@/lib/providers/chat";
import type { Message, PipelineReviewResult } from "@/lib/orchestration/types";

// In plain terms: internal QA review pass for Loco draft answers, using a versioned prompt + Zod validation.

export function parsePipelineReviewResult(content: string): PipelineReviewResult {
  const validated = parseJsonAndValidate(PipelineReviewSchema, content);
  if (!validated.ok) {
    console.error("Failed to validate pipeline review result:", validated.issues, content);
    return {
      approved: false,
      matchesUserRequest: false,
      worksLikely: false,
      updatedUserQuery: "Revise the answer so it fully satisfies the user request and fixes the identified issues.",
      reviewerNotes: "The internal reviewer returned an invalid result. Regenerate the answer more clearly and completely.",
      fixes: [
        "Return a complete answer.",
        "Ensure the response is specific to the user's request.",
        "Provide well-formed code blocks when code is needed.",
        ...validated.issues,
      ],
    };
  }

  return validated.data;
}

export async function reviewLocoResponse(input: {
  systemPrompt: string;
  recentMessages: Message[];
  latestUserMessage: string;
  candidateResponse: string;
  attachmentContext: string;
  previewRuntimeIssueContext: string;
  codeSummary: string;
  formattedCode: string;
  currentLanguage: string;
}) {
  const reviewPrompt = await getPrompt("pipeline-review");

  const reviewMessages: Message[] = [
    { role: "system", content: reviewPrompt.content },
    { role: "system", content: `PRIMARY LOCO SYSTEM PROMPT:\n${input.systemPrompt}` },
    ...(input.attachmentContext ? [{ role: "system" as const, content: `ATTACHMENT CONTEXT:\n${input.attachmentContext}` }] : []),
    ...(input.previewRuntimeIssueContext ? [{ role: "system" as const, content: input.previewRuntimeIssueContext }] : []),
    ...(input.codeSummary ? [{ role: "system" as const, content: `CODE SUMMARY:\n${input.codeSummary}` }] : []),
    ...(input.formattedCode ? [{ role: "system" as const, content: `CURRENT CODE WITH LINE NUMBERS:\n${input.formattedCode}` }] : []),
    { role: "system", content: `CURRENT LANGUAGE: ${input.currentLanguage}` },
    ...input.recentMessages,
    { role: "system", content: `LATEST USER REQUEST:\n${input.latestUserMessage}` },
    { role: "assistant", content: input.candidateResponse },
  ];

  const reviewResponse = await callOpenAIChat(reviewMessages, {
    temperature: 0.1,
    maxTokens: 500,
    responseFormat: { type: "json_object" },
  });

  return parsePipelineReviewResult(reviewResponse);
}
