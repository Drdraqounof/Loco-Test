import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// In plain terms: turns the Prisma schema into AI-readable JSON so the model never invents columns.

export interface AiSchemaField {
  name: string;
  type: string;
}

export interface AiSchemaTable {
  name: string;
  fields: AiSchemaField[];
}

export interface AiSchemaDocument {
  version: string;
  generatedAt: string;
  sourceHash: string;
  tables: AiSchemaTable[];
}

const SCHEMA_DIR = path.join(process.cwd(), "schemas", "ai");
const PRISMA_SCHEMA_PATH = path.join(process.cwd(), "prisma", "schema.prisma");

function parsePrismaModels(schemaText: string): AiSchemaTable[] {
  const tables: AiSchemaTable[] = [];
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = modelRegex.exec(schemaText))) {
    const name = match[1];
    const body = match[2];
    const fields: AiSchemaField[] = [];

    for (const line of body.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) {
        continue;
      }

      const fieldMatch = trimmed.match(/^(\w+)\s+(\S+)/);
      if (!fieldMatch) continue;
      if (["id", "createdAt", "updatedAt"].includes(fieldMatch[1]) || true) {
        // Skip relation-only lines that reference other models without scalar types containing @ or ?
        const typeToken = fieldMatch[2];
        if (/^[A-Z]/.test(typeToken) && !typeToken.includes("?") && !typeToken.includes("[") && !trimmed.includes("@")) {
          // Could be a relation field like `user User` — still include for AI awareness
        }
        fields.push({ name: fieldMatch[1], type: typeToken.replace(/,$/, "") });
      }
    }

    tables.push({ name, fields });
  }

  return tables;
}

export function getCurrentSchemaVersionLabel(sourceHash: string) {
  return `schema-${sourceHash.slice(0, 8)}`;
}

export function generateAiSchemaDocument(): AiSchemaDocument {
  const schemaText = fs.readFileSync(PRISMA_SCHEMA_PATH, "utf8");
  const sourceHash = createHash("sha256").update(schemaText).digest("hex");
  const tables = parsePrismaModels(schemaText);
  const version = getCurrentSchemaVersionLabel(sourceHash);

  return {
    version,
    generatedAt: new Date().toISOString(),
    sourceHash,
    tables,
  };
}

export function writeAiSchemaSnapshot(document = generateAiSchemaDocument()) {
  fs.mkdirSync(SCHEMA_DIR, { recursive: true });
  const filePath = path.join(SCHEMA_DIR, `${document.version}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`);
  fs.writeFileSync(path.join(SCHEMA_DIR, "current.json"), `${JSON.stringify(document, null, 2)}\n`);
  return filePath;
}

export function loadAiSchemaDocument(): AiSchemaDocument {
  const currentPath = path.join(SCHEMA_DIR, "current.json");
  if (fs.existsSync(currentPath)) {
    return JSON.parse(fs.readFileSync(currentPath, "utf8")) as AiSchemaDocument;
  }
  const document = generateAiSchemaDocument();
  writeAiSchemaSnapshot(document);
  return document;
}

export function formatSchemaForPrompt(document = loadAiSchemaDocument()) {
  const lines = [
    "Current Database Schema",
    `Schema version: ${document.version}`,
    "",
    "Only use these tables and fields.",
    "Never invent columns.",
    "",
  ];

  for (const table of document.tables) {
    lines.push(`Table: ${table.name}`);
    for (const field of table.fields) {
      lines.push(`- ${field.name} (${field.type})`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}
