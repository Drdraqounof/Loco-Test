import { prisma } from "@/lib/prisma";

export interface RememberedYouTubeVideoChoice {
  id: string;
  title: string;
  url: string;
  channel: string;
  publishedAt: string | null;
  viewCount: number;
}

export interface RememberedYouTubeListen {
  requestQuery: string;
  video: RememberedYouTubeVideoChoice;
  variantLabel?: string;
  playedAt: string;
}

export const YOUTUBE_PLAYBACK_MEMORY_KIND = "youtube-playback";

function normalizeYouTubeMemoryKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildMemoryKey(requestQuery: string) {
  return `${YOUTUBE_PLAYBACK_MEMORY_KIND}:${normalizeYouTubeMemoryKey(requestQuery)}`;
}

function parseRememberedYouTubeListen(content: string): RememberedYouTubeListen | null {
  try {
    const parsed = JSON.parse(content);
    if (
      !parsed ||
      typeof parsed.requestQuery !== "string" ||
      typeof parsed.playedAt !== "string" ||
      !parsed.video ||
      typeof parsed.video.id !== "string" ||
      typeof parsed.video.title !== "string" ||
      typeof parsed.video.url !== "string" ||
      typeof parsed.video.channel !== "string"
    ) {
      return null;
    }

    return {
      requestQuery: parsed.requestQuery,
      playedAt: parsed.playedAt,
      variantLabel: typeof parsed.variantLabel === "string" ? parsed.variantLabel : undefined,
      video: {
        id: parsed.video.id,
        title: parsed.video.title,
        url: parsed.video.url,
        channel: parsed.video.channel,
        publishedAt: typeof parsed.video.publishedAt === "string" || parsed.video.publishedAt === null ? parsed.video.publishedAt : null,
        viewCount: typeof parsed.video.viewCount === "number" ? parsed.video.viewCount : 0,
      },
    };
  } catch {
    return null;
  }
}

export async function rememberYouTubePlayback(listen: RememberedYouTubeListen) {
  const normalizedContent = buildMemoryKey(listen.requestQuery);
  const content = JSON.stringify({
    requestQuery: listen.requestQuery,
    video: listen.video,
    variantLabel: listen.variantLabel,
    playedAt: listen.playedAt,
  });

  return prisma.assistantMemory.upsert({
    where: { normalizedContent },
    update: {
      kind: YOUTUBE_PLAYBACK_MEMORY_KIND,
      content,
    },
    create: {
      source: "loco",
      kind: YOUTUBE_PLAYBACK_MEMORY_KIND,
      content,
      normalizedContent,
    },
  });
}

export async function listRememberedYouTubePlaybacks(limit = 12) {
  const memories = await prisma.assistantMemory.findMany({
    where: {
      source: "loco",
      kind: YOUTUBE_PLAYBACK_MEMORY_KIND,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return memories
    .map((memory) => parseRememberedYouTubeListen(memory.content))
    .filter((memory): memory is RememberedYouTubeListen => Boolean(memory));
}