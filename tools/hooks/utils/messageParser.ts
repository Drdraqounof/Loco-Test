// In plain terms: this file pulls useful pieces like code blocks and commands out of AI responses.

import { extractEarthTourPlan, stripEarthTourBlock, type EarthTourPlan } from "@/lib/earthTour";

export interface ParsedResponse {
  commands: string[];
  codeBlocks: Array<{
    language: string;
    code: string;
  }>;
  cleanText: string;
  tourPlan: EarthTourPlan | null;
}

/**
 * Extract all code blocks (supports multiple blocks and different fence types)
 */
export function extractMultipleCodeBlocks(
  text: string
): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = [];
  
  // Support ``` fences
  const backtickRegex = /```([^`\n]*)\n([\s\S]*?)```/g;
  let match;
  
  while ((match = backtickRegex.exec(text)) !== null) {
    const language = (match[1] || "").trim() || "javascript";
    const code = (match[2] || "").trim();

    if (language.toLowerCase() === "loco-tour") {
      continue;
    }
    
    if (code && code.length > 0) {
      blocks.push({ language, code });
    }
  }
  
  // Also support ~~~ fences
  const tildeRegex = /~~~([^~\n]*)\n([\s\S]*?)~~~/g;
  while ((match = tildeRegex.exec(text)) !== null) {
    const language = (match[1] || "").trim() || "javascript";
    const code = (match[2] || "").trim();

    if (language.toLowerCase() === "loco-tour") {
      continue;
    }
    
    if (code && code.length > 0) {
      blocks.push({ language, code });
    }
  }
  
  return blocks;
}

/**
 * Extract terminal commands ($ prefix lines)
 */
export function extractTerminalCommands(text: string): string[] {
  const commandPattern = /\$\s+(.+?)(?:\n|$)/g;
  const commands: string[] = [];
  let match;
  
  while ((match = commandPattern.exec(text)) !== null) {
    commands.push(match[1].trim());
  }
  
  return commands;
}

/**
 * Strip code blocks from text for display
 */
export function stripCodeFromResponse(text: string): string {
  let cleaned = text
    .replace(/```[\w-]*\n?[\s\S]*?```/g, "")
    .replace(/~~~[\w-]*\n?[\s\S]*?~~~/g, "");
  
  // Remove decorative UI text that the AI sometimes includes
  cleaned = cleaned
    .replace(/^Code Output\s*$/gm, "")
    .replace(/^✕\s*$/gm, "")
    .replace(/^Commands\s*$/gm, "")
    .replace(/^Code Output\n/gm, "")
    .replace(/^Commands\n/gm, "")
    .replace(/✕\n/g, "");

  cleaned = stripEarthTourBlock(cleaned);
  
  return cleaned.trim();
}

/**
 * Parse AI response into commands, code blocks, and clean text
 */
export function parseResponse(text: string): ParsedResponse {
  const commands = extractTerminalCommands(text);
  const codeBlocks = extractMultipleCodeBlocks(text);
  const tourPlan = extractEarthTourPlan(text);
  const cleanText = stripCodeFromResponse(text);
  
  return {
    commands,
    codeBlocks,
    cleanText,
    tourPlan,
  };
}
