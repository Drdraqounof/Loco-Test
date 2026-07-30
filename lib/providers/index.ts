// In plain terms: shared AI provider surface for chat, speech synthesis, and STT.

export { callOpenAIChat, callClaudeChat } from "@/lib/providers/chat";
export { synthesizeSpeech } from "@/lib/providers/tts";
export { transcribeAudio } from "@/lib/providers/stt";
