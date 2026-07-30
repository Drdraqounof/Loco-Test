// In plain terms: business rules live in code so the AI reads them instead of inventing policy.

export const LOCO_BUSINESS_RULES = {
  version: "rules-v1",
  calendar: {
    requireExplicitConfirmationBeforeCreate: true,
    requireExplicitConfirmationBeforeBulkDelete: true,
    defaultEventDurationMinutes: 60,
    allowedStatuses: ["draft", "confirmed", "cancelled"] as const,
  },
  memory: {
    allowExplicitRememberRequests: true,
    rejectEmptyMemoryContent: true,
    maxMemoryContentLength: 2000,
  },
  assistants: {
    allowedModes: ["auto", "loco", "claude"] as const,
    preferClaudeForCodeAndGamesInAuto: true,
  },
  media: {
    youtubePersonalLibraryRequiresOAuth: true,
    rejectVaguePlayRequests: true,
  },
} as const;

export function formatBusinessRulesForPrompt(rules = LOCO_BUSINESS_RULES) {
  return [
    "Business Rules (authoritative — do not invent policy)",
    `Rules version: ${rules.version}`,
    "",
    "Calendar:",
    `- Confirm before creating events: ${rules.calendar.requireExplicitConfirmationBeforeCreate}`,
    `- Confirm before bulk delete: ${rules.calendar.requireExplicitConfirmationBeforeBulkDelete}`,
    `- Default event duration minutes: ${rules.calendar.defaultEventDurationMinutes}`,
    `- Allowed draft statuses: ${rules.calendar.allowedStatuses.join(", ")}`,
    "",
    "Memory:",
    `- Explicit remember requests allowed: ${rules.memory.allowExplicitRememberRequests}`,
    `- Reject empty memory content: ${rules.memory.rejectEmptyMemoryContent}`,
    `- Max memory content length: ${rules.memory.maxMemoryContentLength}`,
    "",
    "Assistants:",
    `- Allowed modes: ${rules.assistants.allowedModes.join(", ")}`,
    `- Auto prefers Claude for code/games: ${rules.assistants.preferClaudeForCodeAndGamesInAuto}`,
    "",
    "Media:",
    `- YouTube personal library requires OAuth: ${rules.media.youtubePersonalLibraryRequiresOAuth}`,
    `- Reject vague play requests: ${rules.media.rejectVaguePlayRequests}`,
  ].join("\n");
}
