import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { isPersistenceUnavailableError } from "@/lib/persistence";

// In plain terms: loads versioned prompts from /prompts markdown files, with optional DB overrides.

export interface PromptRecord {
  id: string;
  name: string;
  version: number;
  content: string;
  source: "file" | "database";
  updatedAt: string;
}

interface PromptFrontmatter {
  name?: string;
  version?: number;
  updated_at?: string;
}

const PROMPTS_DIR = path.join(process.cwd(), "prompts");

function parseFrontmatter(raw: string): { meta: PromptFrontmatter; body: string } {
  if (!raw.startsWith("---")) {
    return { meta: {}, body: raw.trim() };
  }

  const end = raw.indexOf("\n---", 3);
  if (end < 0) {
    return { meta: {}, body: raw.trim() };
  }

  const front = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  const meta: PromptFrontmatter = {};

  for (const line of front.split(/\r?\n/)) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (key === "version") {
      meta.version = Number(value);
    } else if (key === "name") {
      meta.name = value.trim();
    } else if (key === "updated_at") {
      meta.updated_at = value.trim();
    }
  }

  return { meta, body };
}

function renderTemplate(content: string, vars: Record<string, string>) {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export function listFilePrompts(): PromptRecord[] {
  if (!fs.existsSync(PROMPTS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(PROMPTS_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(PROMPTS_DIR, file), "utf8");
      const { meta, body } = parseFrontmatter(raw);
      const name = meta.name || file.replace(/\.md$/, "");
      return {
        id: `file:${name}@${meta.version || 1}`,
        name,
        version: meta.version || 1,
        content: body,
        source: "file" as const,
        updatedAt: meta.updated_at || new Date(0).toISOString(),
      };
    });
}

export async function getPrompt(
  name: string,
  vars: Record<string, string> = {},
  preferredVersion?: number
): Promise<PromptRecord> {
  try {
    const dbPrompt = await prisma.prompt.findFirst({
      where: {
        name,
        ...(preferredVersion ? { version: preferredVersion } : { isActive: true }),
      },
      orderBy: { version: "desc" },
    });

    if (dbPrompt) {
      return {
        id: dbPrompt.id,
        name: dbPrompt.name,
        version: dbPrompt.version,
        content: renderTemplate(dbPrompt.content, vars),
        source: "database",
        updatedAt: dbPrompt.updatedAt.toISOString(),
      };
    }
  } catch (error) {
    if (!isPersistenceUnavailableError(error)) {
      console.warn(`Prompt DB lookup failed for ${name}; using file prompts.`, error);
    }
  }

  const filePrompt = listFilePrompts()
    .filter((prompt) => prompt.name === name)
    .sort((a, b) => b.version - a.version)
    .find((prompt) => (preferredVersion ? prompt.version === preferredVersion : true));

  if (!filePrompt) {
    throw new Error(`Prompt not found: ${name}`);
  }

  return {
    ...filePrompt,
    content: renderTemplate(filePrompt.content, vars),
  };
}

export async function syncFilePromptsToDatabase() {
  const files = listFilePrompts();
  for (const prompt of files) {
    await prisma.prompt.upsert({
      where: {
        name_version: {
          name: prompt.name,
          version: prompt.version,
        },
      },
      update: {
        content: prompt.content,
        isActive: true,
      },
      create: {
        name: prompt.name,
        version: prompt.version,
        content: prompt.content,
        isActive: true,
      },
    });
  }
  return files.length;
}
