export interface ParsedResponse {
  commands: string[];
  codeBlocks: Array<{
    language: string;
    code: string;
  }>;
  cleanText: string;
}

/**
 * Extract all code blocks (supports multiple blocks and different fence types)
 */
export function extractMultipleCodeBlocks(
  text: string
): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = [];
  
  // Support both ``` and ~~~ fences
  const codeBlockRegex =
    /```+([^\n`]*)\n?([\s\S]*?)```+|~~~+([^\n~]*)\n?([\s\S]*?)~~~+/g;
  
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const language = (match[1] || match[3] || "").trim() || "javascript";
    const code = (match[2] || match[4] || "").trim();
    
    if (code) {
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
  return text
    .replace(/```[\w-]*\n?[\s\S]*?```/g, "")
    .replace(/~~~[\w-]*\n?[\s\S]*?~~~/g, "")
    .trim();
}

/**
 * Parse AI response into commands, code blocks, and clean text
 */
export function parseResponse(text: string): ParsedResponse {
  const commands = extractTerminalCommands(text);
  const codeBlocks = extractMultipleCodeBlocks(text);
  const cleanText = stripCodeFromResponse(text);
  
  return {
    commands,
    codeBlocks,
    cleanText,
  };
}
