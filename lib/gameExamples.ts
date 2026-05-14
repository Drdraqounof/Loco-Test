import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const GAMES_EXAMPLES_DIR = join(process.cwd(), "examples", "games");

interface GameExample {
  name: string;
  files: Record<string, string>;
  summary: string;
}

function isValidGamesDir(): boolean {
  try {
    const stats = statSync(GAMES_EXAMPLES_DIR);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

function extractHtmlSections(htmlContent: string): {
  html: string;
  css: string;
  js: string;
} {
  // Extract CSS from <style> tags
  const styleMatch = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const css = styleMatch ? styleMatch[1].trim() : "";

  // Extract JS from <script> tags (inline scripts only)
  const scriptMatches = htmlContent.matchAll(
    /<script[^>]*>([\s\S]*?)<\/script>/g
  );
  let js = "";
  for (const match of scriptMatches) {
    if (!match[1].includes("src=")) {
      js += (js ? "\n\n" : "") + match[1].trim();
    }
  }

  return {
    html: htmlContent,
    css,
    js,
  };
}

function createGameSummary(name: string, htmlContent: string): string {
  const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/);
  const title = titleMatch ? titleMatch[1] : name;

  const hasCanvas = htmlContent.includes("<canvas");
  const hasAnimation = htmlContent.includes("requestAnimationFrame") ||
    htmlContent.includes("setInterval") ||
    htmlContent.includes("animate");

  const features = [];
  if (hasCanvas) features.push("Canvas-based");
  if (hasAnimation) features.push("Animated");
  if (htmlContent.includes("addEventListener")) features.push("Interactive");
  if (htmlContent.includes("getContext")) features.push("2D Graphics");

  return `Game: **${title}**\nType: ${features.join(" • ")}\nFile: ${name}`;
}

export function loadGameExamples(): GameExample[] {
  const examples: GameExample[] = [];

  if (!isValidGamesDir()) {
    return examples;
  }

  try {
    const gameFolders = readdirSync(GAMES_EXAMPLES_DIR);

    for (const folder of gameFolders) {
      const folderPath = join(GAMES_EXAMPLES_DIR, folder);
      const folderStats = statSync(folderPath);

      if (!folderStats.isDirectory()) {
        continue;
      }

      const files: Record<string, string> = {};

      try {
        const fileList = readdirSync(folderPath);

        for (const file of fileList) {
          const filePath = join(folderPath, file);
          const fileStats = statSync(filePath);

          if (fileStats.isFile()) {
            try {
              const content = readFileSync(filePath, "utf-8");

              // For HTML files, extract and organize sections
              if (file.endsWith(".html")) {
                const { html, css, js } = extractHtmlSections(content);
                files[file] = html;
                if (css) files[`${file}_styles`] = css;
                if (js) files[`${file}_script`] = js;
              } else {
                files[file] = content;
              }
            } catch {
              // Skip files we can't read
            }
          }
        }
      } catch {
        // Skip folders we can't read
      }

      if (Object.keys(files).length > 0) {
        const fileNames = Object.keys(files);
        const mainFile = fileNames.find((f) => f.endsWith(".html")) || fileNames[0];
        const summary = mainFile
          ? createGameSummary(
              folder,
              files[mainFile] || Object.values(files)[0] || ""
            )
          : `Game: ${folder}`;

        examples.push({
          name: folder,
          files,
          summary,
        });
      }
    }
  } catch {
    // Return empty array if we can't read the games directory
  }

  return examples;
}

export function formatGameExamplesForContext(examples: GameExample[]): string {
  if (examples.length === 0) {
    return "";
  }

  let context = ``;

  for (const example of examples) {
    for (const [fileName, fileContent] of Object.entries(example.files)) {
      if (fileName.endsWith(".html")) {
        const lineCount = fileContent.split('\n').length;
        
        // Build context with EXACT copy requirement
        context = `YOU MUST COPY THIS GAME CODE EXACTLY.

INSTRUCTION: Output the code below verbatim (character-for-character).
Do NOT create, modify, or change anything.
Do NOT add explanations before or after.
Do NOT change variable names, function names, or HTML structure.
Do NOT add or remove any code.

OUTPUT REQUIREMENT: Exactly ${lineCount} lines (no more, no less).

--- BEGIN EXACT COPY ---
${fileContent}
--- END EXACT COPY ---

VALIDATION:
- Your output MUST start with <!DOCTYPE html>
- Your output MUST end with </html>
- Your output MUST be exactly ${lineCount} lines
- Your output MUST match the code above character-for-character

If you cannot copy this exactly, output nothing.
You only have ONE job: Copy the code between --- BEGIN EXACT COPY --- and --- END EXACT COPY --- exactly as shown.

NOW COPY THE CODE EXACTLY:`;
      }
    }
  }

  return context;
}
