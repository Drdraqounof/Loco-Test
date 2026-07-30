import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const schemaText = fs.readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
const sourceHash = createHash("sha256").update(schemaText).digest("hex");
const tables = [];
const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
let match;
while ((match = modelRegex.exec(schemaText))) {
  const fields = [];
  for (const line of match[2].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) continue;
    const fieldMatch = trimmed.match(/^(\w+)\s+(\S+)/);
    if (fieldMatch) {
      fields.push({ name: fieldMatch[1], type: fieldMatch[2].replace(/,$/, "") });
    }
  }
  tables.push({ name: match[1], fields });
}

const document = {
  version: `schema-${sourceHash.slice(0, 8)}`,
  generatedAt: new Date().toISOString(),
  sourceHash,
  tables,
};

const outDir = path.join(root, "schemas", "ai");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${document.version}.json`), `${JSON.stringify(document, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, "current.json"), `${JSON.stringify(document, null, 2)}\n`);
console.log(`Wrote ${document.version} (${tables.length} tables)`);
