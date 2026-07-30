import { prisma } from "@/lib/prisma";
import { isPersistenceUnavailableError } from "@/lib/persistence";

// In plain terms: stores every AI interaction so failures can be debugged later.

export interface AiInteractionLogInput {
  model: string;
  promptName?: string | null;
  promptVersion?: number | null;
  schemaVersion?: string | null;
  rulesVersion?: string | null;
  temperature?: number | null;
  userInput: string;
  aiOutput?: string | null;
  validationResult?: string | null;
  routingProvider?: string | null;
  executionTimeMs: number;
  success: boolean;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logAiInteraction(input: AiInteractionLogInput) {
  try {
    return await prisma.aiInteractionLog.create({
      data: {
        model: input.model,
        promptName: input.promptName ?? null,
        promptVersion: input.promptVersion ?? null,
        schemaVersion: input.schemaVersion ?? null,
        rulesVersion: input.rulesVersion ?? null,
        temperature: input.temperature ?? null,
        userInput: input.userInput,
        aiOutput: input.aiOutput ?? null,
        validationResult: input.validationResult ?? null,
        routingProvider: input.routingProvider ?? null,
        executionTimeMs: input.executionTimeMs,
        success: input.success,
        errorMessage: input.errorMessage ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (error) {
    if (isPersistenceUnavailableError(error)) {
      console.warn("AI interaction log persistence unavailable; skipping log write.");
      return null;
    }
    console.warn("Failed to write AI interaction log:", error);
    return null;
  }
}
