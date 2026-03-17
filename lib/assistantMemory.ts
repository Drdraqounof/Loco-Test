import { prisma } from "@/lib/prisma";
import { scoreMemoryRelevance } from "@/lib/memoryRetrieval";

// In plain terms: this file stores and recalls long-term facts the assistant should remember.

export interface RelevantAssistantMemoryMatch {
  content: string;
  kind: string;
}

export interface RelevantAssistantMemoryResult {
  context: string;
  matches: RelevantAssistantMemoryMatch[];
}

const EXPLICIT_MEMORY_PATTERN = /^(remember(?: that)?|for future reference|keep in mind|please remember)\s+/i;
const MEMORY_RECALL_PATTERN = /(what|tell me|show me)[\s\S]*(remember|know) (?:about me|about us)?|what do you remember about me|what do you know about me|what are my preferences/i;

function normalizeMemoryContent(content: string) {
  return content.replace(/\s+/g, " ").trim().toLowerCase();
}

function trimMemoryContent(content: string, maxLength = 300) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength).trim();
}

export function isExplicitMemoryRequest(text: string) {
  return EXPLICIT_MEMORY_PATTERN.test(text.trim());
}

export function looksLikeMemoryRecallQuestion(text: string) {
  return MEMORY_RECALL_PATTERN.test(text.trim());
}

export function extractMemoryContent(text: string) {
  return trimMemoryContent(text.replace(EXPLICIT_MEMORY_PATTERN, ""));
}

export function inferImplicitMemoryCandidate(text: string) {
  const trimmed = text.trim();
  const patterns = [
    /^my name is (.+)$/i,
    /^call me (.+)$/i,
    /^i prefer (.+)$/i,
    /^my favorite (.+)$/i,
    /^i work on (.+)$/i,
    /^i am working on (.+)$/i,
    /^i usually need (.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[0]) {
      return trimMemoryContent(match[0]);
    }
  }

  return null;
}

export async function rememberAssistantFact(content: string, kind = "fact") {
  const normalizedContent = normalizeMemoryContent(content);
  if (!normalizedContent) {
    return null;
  }

  return prisma.assistantMemory.upsert({
    where: { normalizedContent },
    update: {
      content: trimMemoryContent(content),
      kind,
    },
    create: {
      source: "loco",
      kind,
      content: trimMemoryContent(content),
      normalizedContent,
    },
  });
}

export async function listAssistantMemories(limit = 12) {
  return prisma.assistantMemory.findMany({
    where: { source: "loco" },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

export async function listRelevantAssistantMemories(query: string, limit = 4) {
  const memories = await prisma.assistantMemory.findMany({
    where: { source: "loco" },
    orderBy: { updatedAt: "desc" },
    take: 60,
  });

  return memories
    .map((memory) => ({
      memory,
      score: scoreMemoryRelevance(query, memory.content),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => entry.memory);
}

export async function buildAssistantMemoryContext(limit = 12) {
  const memories = await listAssistantMemories(limit);
  if (memories.length === 0) {
    return "";
  }

  return `\nLong-term remembered user facts:\n${memories.map((memory) => `- ${memory.content}`).join("\n")}`;
}

export async function buildRelevantAssistantMemoryContext(query: string, limit = 4) {
  const memories = await listRelevantAssistantMemories(query, limit);
  if (memories.length === 0) {
    return {
      context: "",
      matches: [],
    } satisfies RelevantAssistantMemoryResult;
  }

  return {
    context: `\nRelevant remembered facts for this message:\n${memories.map((memory) => `- ${memory.content}`).join("\n")}`,
    matches: memories.map((memory) => ({
      content: memory.content,
      kind: memory.kind,
    })),
  } satisfies RelevantAssistantMemoryResult;
}

export async function formatAssistantMemoryRecall(limit = 12) {
  const memories = await listAssistantMemories(limit);
  if (memories.length === 0) {
    return "I don't have any personal notes saved yet. Tell me something with 'remember that ...' and I'll keep it in mind.";
  }

  return `Here is what I currently remember about you:\n\n${memories.map((memory) => `- ${memory.content}`).join("\n")}`;
}