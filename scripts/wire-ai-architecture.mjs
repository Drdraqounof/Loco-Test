import fs from "node:fs";

const routePath = "app/api/route.ts";
let src = fs.readFileSync(routePath, "utf8");

if (!src.includes('from "@/lib/ai/context"')) {
  src = src.replace(
    'import { resolveAssistantRouting } from "@/lib/assistant/routing";',
    `import { resolveAssistantRouting } from "@/lib/assistant/routing";
import { assembleStatelessAiContext } from "@/lib/ai/context";
import { getPrompt } from "@/lib/ai/prompts";
import { logAiInteraction } from "@/lib/ai/logging";
import { MemoryFactSchema, validateWithSchema } from "@/lib/ai/validation";`
  );
}

const markerStart = "    const systemPrompt = `";
const start = src.indexOf(markerStart);
if (start < 0) {
  throw new Error("systemPrompt block not found");
}

const afterStart = start + markerStart.length;
const endTick = src.indexOf("`;", afterStart);
if (endTick < 0) {
  throw new Error("systemPrompt end not found");
}

const replacement = `    const aiContext = await assembleStatelessAiContext({
      promptName: "loco-system",
      userGreeting,
      userContext,
      includeSchema: true,
      includeRules: true,
      includeToolSnapshots: true,
    });
    const systemPrompt = aiContext.systemPrompt;`;

src = src.slice(0, start) + replacement + src.slice(endTick + 2);

// Planet tour: load versioned prompt
src = src.replace(
  /if \(shouldGeneratePlanetTour\) \{\s*const planetTourInstruction = \[[\s\S]*?\]\.join\("\\n"\);\s*\n\s*finalSystemPrompt = `\$\{finalSystemPrompt\}\\n\\n\$\{planetTourInstruction\}`;\s*\}/,
  `if (shouldGeneratePlanetTour) {
      const planetTourPrompt = await getPrompt("planet-tour");
      finalSystemPrompt = \`\${finalSystemPrompt}\\n\\n\${planetTourPrompt.content}\`;
    }`
);

// Explicit memory validation
src = src.replace(
  `if (!memoryContent) {
        return NextResponse.json({
          success: true,
          message: "Tell me what you want me to remember, for example: remember that I prefer short answers.",
          audio: null,
        });
      }

      const memorySave = await withOptionalPersistence(`,
  `if (!memoryContent) {
        return NextResponse.json({
          success: true,
          message: "Tell me what you want me to remember, for example: remember that I prefer short answers.",
          audio: null,
        });
      }

      const memoryValidation = validateWithSchema(MemoryFactSchema, { content: memoryContent, kind: "explicit" });
      if (!memoryValidation.ok) {
        return NextResponse.json({
          success: true,
          message: \`I couldn't save that memory: \${memoryValidation.issues.join("; ")}\`,
          audio: null,
          validation: memoryValidation,
        });
      }

      const memorySave = await withOptionalPersistence(`
);

// Wrap generation with timing + logging before final return
if (!src.includes("const generationStartedAt")) {
  src = src.replace(
    "    const routing = resolveAssistantRouting({",
    `    const generationStartedAt = Date.now();
    const routing = resolveAssistantRouting({`
  );

  src = src.replace(
    `    return NextResponse.json({
      success: true,
      message: aiMessage,
      audio: audioBase64,
      memoryHit,
      memorySources,
      memoryMatches,
      routing: {`,
    `    await logAiInteraction({
      model: (routingFallbackReason ? "openai" : routing.provider) === "claude"
        ? "claude-3-5-sonnet-20241022"
        : (process.env.OPENAI_MODEL || "gpt-4o-mini"),
      promptName: aiContext.promptName,
      promptVersion: aiContext.promptVersion,
      schemaVersion: aiContext.schemaVersion,
      rulesVersion: aiContext.rulesVersion,
      temperature: tokenConfig.temperature,
      userInput: latestUserMessage,
      aiOutput: aiMessage,
      validationResult: pipelineReview.approved ? "approved" : "needs_revision",
      routingProvider: routingFallbackReason ? "openai" : routing.provider,
      executionTimeMs: Date.now() - generationStartedAt,
      success: true,
      metadata: {
        routing,
        pipeline: {
          approved: pipelineReview.approved,
          matchesUserRequest: pipelineReview.matchesUserRequest,
          worksLikely: pipelineReview.worksLikely,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: aiMessage,
      audio: audioBase64,
      memoryHit,
      memorySources,
      memoryMatches,
      ai: {
        promptName: aiContext.promptName,
        promptVersion: aiContext.promptVersion,
        schemaVersion: aiContext.schemaVersion,
        rulesVersion: aiContext.rulesVersion,
      },
      routing: {`
  );
}

fs.writeFileSync(routePath, src);
console.log("Patched app/api/route.ts for AI architecture wiring");
