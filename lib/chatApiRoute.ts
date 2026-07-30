// In plain terms: this file is reserved for shared chat API route logic; orchestration now lives under lib/orchestration and lib/providers.

export { withOptionalPersistence } from "@/lib/orchestration/openaiTransport";
export { reviewLocoResponse } from "@/lib/orchestration/review";
export { resolveAssistantRouting } from "@/lib/assistant/routing";
export { callClaudeChat, callOpenAIChat, synthesizeSpeech, transcribeAudio } from "@/lib/providers";
