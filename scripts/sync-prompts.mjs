import { createRequire } from "node:module";

// Sync file prompts into DB using compiled/ts-node-free dynamic import via next-free path.
// Uses Prisma client directly to avoid TS loader issues.

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs");
const path = require("node:path");

const prisma = new PrismaClient();
const promptsDir = path.join(process.cwd(), "prompts");

function parsePrompt(file) {
  const raw = fs.readFileSync(path.join(promptsDir, file), "utf8");
  const nameMatch = raw.match(/^name:\s*(.+)$/m);
  const versionMatch = raw.match(/^version:\s*(\d+)/m);
  const parts = raw.split(/\n---\n/);
  const body = parts.length >= 3 ? parts.slice(2).join("\n---\n").trim() : raw.trim();
  return {
    name: (nameMatch?.[1] || file.replace(/\.md$/, "")).trim(),
    version: Number(versionMatch?.[1] || 1),
    content: body,
  };
}

async function main() {
  const files = fs.readdirSync(promptsDir).filter((file) => file.endsWith(".md"));
  for (const file of files) {
    const prompt = parsePrompt(file);
    await prisma.prompt.upsert({
      where: { name_version: { name: prompt.name, version: prompt.version } },
      update: { content: prompt.content, isActive: true },
      create: {
        name: prompt.name,
        version: prompt.version,
        content: prompt.content,
        isActive: true,
      },
    });
    console.log(`synced ${prompt.name}@${prompt.version}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
