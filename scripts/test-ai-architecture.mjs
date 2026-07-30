import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";

const root = process.cwd();

function listFilePrompts() {
  const dir = path.join(root, "prompts");
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const nameMatch = raw.match(/^name:\s*(.+)$/m);
      const versionMatch = raw.match(/^version:\s*(\d+)/m);
      const body = raw.includes("---\n") ? raw.split("---\n").slice(2).join("---\n").trim() : raw;
      return {
        name: (nameMatch?.[1] || file.replace(/\.md$/, "")).trim(),
        version: Number(versionMatch?.[1] || 1),
        content: body,
      };
    });
}

function generateSchemaDoc() {
  const schemaText = fs.readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
  const sourceHash = createHash("sha256").update(schemaText).digest("hex");
  const tables = [];
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let match;
  while ((match = modelRegex.exec(schemaText))) {
    tables.push({ name: match[1] });
  }
  return { version: `schema-${sourceHash.slice(0, 8)}`, tables };
}

const PipelineReviewSchema = z.object({
  approved: z.boolean(),
  matchesUserRequest: z.boolean(),
  worksLikely: z.boolean(),
  updatedUserQuery: z.string().min(1),
  reviewerNotes: z.string().min(1),
  fixes: z.array(z.string()),
});

const MemoryFactSchema = z.object({
  content: z.string().min(1).max(2000),
  kind: z.enum(["explicit", "implicit", "fact"]).default("fact"),
});

const prompts = listFilePrompts();
for (const name of ["loco-system", "pipeline-review", "planet-tour"]) {
  assert.ok(prompts.some((prompt) => prompt.name === name), `Missing prompt: ${name}`);
}

const loco = prompts.find((prompt) => prompt.name === "loco-system");
assert.ok(loco.content.includes("You are Loco"));
assert.equal(loco.version, 1);

const schema = generateSchemaDoc();
assert.ok(schema.tables.some((table) => table.name === "Prompt"));
assert.ok(schema.tables.some((table) => table.name === "AiInteractionLog"));
assert.ok(fs.existsSync(path.join(root, "schemas", "ai", "current.json")));

assert.equal(
  PipelineReviewSchema.safeParse({
    approved: true,
    matchesUserRequest: true,
    worksLikely: true,
    updatedUserQuery: "ok",
    reviewerNotes: "ok",
    fixes: [],
  }).success,
  true
);
assert.equal(MemoryFactSchema.safeParse({ content: "" }).success, false);

const fixturePath = path.join(root, "prompts", "__fixtures__", "loco-system.expect.json");
if (fs.existsSync(fixturePath)) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  for (const needle of fixture.expectedSubstrings || []) {
    assert.ok(loco.content.includes(needle), `expected: ${needle}`);
  }
}

console.log("AI architecture smoke tests passed");
