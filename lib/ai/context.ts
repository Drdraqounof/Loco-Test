import { formatBusinessRulesForPrompt, LOCO_BUSINESS_RULES } from "@/lib/ai/businessRules";
import { formatSchemaForPrompt, loadAiSchemaDocument } from "@/lib/ai/schemaContext";
import { getPrompt } from "@/lib/ai/prompts";
import { AI_TOOLS } from "@/lib/ai/tools";

// In plain terms: each request builds fresh context (schema + rules + tools + user request). The model does not "remember" the database.

export interface StatelessAiContext {
  promptName: string;
  promptVersion: number;
  schemaVersion: string;
  rulesVersion: string;
  systemPrompt: string;
  schemaBlock: string;
  rulesBlock: string;
  toolContextBlock: string;
}

export async function assembleStatelessAiContext(input: {
  promptName?: string;
  userGreeting?: string;
  userContext?: string;
  includeSchema?: boolean;
  includeRules?: boolean;
  includeToolSnapshots?: boolean;
}): Promise<StatelessAiContext> {
  const prompt = await getPrompt(input.promptName || "loco-system", {
    userGreeting: input.userGreeting || "",
    userContext: input.userContext || "",
  });

  const schema = loadAiSchemaDocument();
  const schemaBlock = input.includeSchema === false ? "" : formatSchemaForPrompt(schema);
  const rulesBlock = input.includeRules === false ? "" : formatBusinessRulesForPrompt(LOCO_BUSINESS_RULES);

  let toolContextBlock = "";
  if (input.includeToolSnapshots !== false) {
    try {
      const [calendarStatus, youtubeStatus] = await Promise.all([
        AI_TOOLS.getCalendarConnectionStatus(),
        AI_TOOLS.getYouTubeConnectionStatus(),
      ]);
      toolContextBlock = [
        "Tool snapshots (fetched just-in-time; not a full database dump):",
        `- Calendar connected: ${calendarStatus.connected}${calendarStatus.email ? ` (${calendarStatus.email})` : ""}`,
        `- YouTube connected: ${youtubeStatus.connected}${youtubeStatus.channelTitle ? ` (${youtubeStatus.channelTitle})` : ""}`,
      ].join("\n");
    } catch {
      toolContextBlock = "Tool snapshots unavailable for this request.";
    }
  }

  const systemPrompt = [
    prompt.content,
    schemaBlock ? `\n\n${schemaBlock}` : "",
    rulesBlock ? `\n\n${rulesBlock}` : "",
    toolContextBlock ? `\n\n${toolContextBlock}` : "",
  ]
    .join("")
    .trim();

  return {
    promptName: prompt.name,
    promptVersion: prompt.version,
    schemaVersion: schema.version,
    rulesVersion: LOCO_BUSINESS_RULES.version,
    systemPrompt,
    schemaBlock,
    rulesBlock,
    toolContextBlock,
  };
}
