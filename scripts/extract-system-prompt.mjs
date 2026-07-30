import fs from "node:fs";

const src = fs.readFileSync("app/api/route.ts", "utf8");
const marker = "const systemPrompt = `";
const start = src.indexOf(marker);
if (start < 0) {
  throw new Error("systemPrompt not found");
}

let i = start + marker.length;
let out = "";
while (i < src.length) {
  const ch = src[i];
  if (ch === "\\" && i + 1 < src.length) {
    out += ch + src[i + 1];
    i += 2;
    continue;
  }
  if (ch === "`") {
    break;
  }
  out += ch;
  i += 1;
}

out = out
  .replace(/\$\{userGreeting\}/g, "{{userGreeting}}")
  .replace(/\$\{userContext\}/g, "{{userContext}}");

const header = `---
name: loco-system
version: 1
updated_at: 2026-07-30
---

`;

fs.mkdirSync("prompts", { recursive: true });
fs.writeFileSync("prompts/loco-system.md", `${header}${out.trim()}\n`);
console.log("wrote prompts/loco-system.md", out.length);
