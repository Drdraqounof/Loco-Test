# AI Architecture

> **Last Updated:** July 30, 2026

> **In plain terms:** This is Loco’s target AI architecture now scaffolded in code: versioned prompts, generated schema context, business rules, validation, tool-style data access, interaction logging, and regression smoke tests.

## Recommended flow

```text
User
  -> Next.js API (POST /api)
  -> AI Orchestrator
       -> Prompt Library (/prompts + optional Prompt table)
       -> Schema snapshot (schemas/ai)
       -> Business Rules (lib/ai/businessRules.ts)
       -> Tools (lib/ai/tools.ts) for just-in-time data
  -> Providers (chat / TTS / STT)
  -> Zod validation where structured JSON is required
  -> PostgreSQL (Neon / local)
  -> AiInteractionLog
```

## What was built

| Practice | Implementation |
|----------|----------------|
| Versioned prompts | [`prompts/*.md`](../prompts) + [`lib/ai/prompts.ts`](../lib/ai/prompts.ts) + Prisma `Prompt` |
| Auto schema for AI | [`lib/ai/schemaContext.ts`](../lib/ai/schemaContext.ts) → [`schemas/ai/`](../schemas/ai) |
| Validation | Zod in [`lib/ai/validation.ts`](../lib/ai/validation.ts); review + memory gates |
| Business rules | [`lib/ai/businessRules.ts`](../lib/ai/businessRules.ts) injected into context |
| Tools instead of DB dumps | [`lib/ai/tools.ts`](../lib/ai/tools.ts) |
| Schema versioning | Hash-based `schema-<hash>` JSON snapshots |
| Interaction logging | Prisma `AiInteractionLog` via [`lib/ai/logging.ts`](../lib/ai/logging.ts) |
| Prompt tests | `npm run test:ai` → [`scripts/test-ai-architecture.mjs`](../scripts/test-ai-architecture.mjs) |
| Stateless assembly | [`lib/ai/context.ts`](../lib/ai/context.ts) builds fresh schema + rules + tools + prompt each request |

## Commands

```bash
# Regenerate AI schema snapshot from prisma/schema.prisma
npm run ai:schema

# Sync markdown prompts into Prompt table (requires DB)
npm run ai:sync-prompts

# Smoke-test prompts / schema / Zod
npm run test:ai

# Apply DB migrations (Prompt + AiInteractionLog + prior user scoping)
npm run prisma:migrate:deploy
```

## Still next (not full MCP yet)

- Full MCP server exposing tools over the protocol
- A/B prompt experiments with traffic splits
- Persisting pipeline metadata into analytics dashboards
- Broader Zod coverage for calendar draft create payloads end-to-end
