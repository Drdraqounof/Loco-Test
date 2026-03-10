import { prisma } from "@/lib/prisma";
import { scoreMemoryRelevance, trimSnippet } from "@/lib/memoryRetrieval";

export interface RelevantConversationMatch {
  date: string;
  userText: string;
  assistantText: string;
}

export interface RelevantConversationResult {
  context: string;
  matches: RelevantConversationMatch[];
}

export interface PersistedChatMessageInput {
  role: "user" | "assistant";
  content: string;
}

export interface PersistedChatSessionInput {
  id?: string;
  title: string;
  messages: PersistedChatMessageInput[];
}

export async function listConversationSessions() {
  return prisma.conversationSession.findMany({
    where: { source: "loco" },
    include: {
      messages: {
        orderBy: { position: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function saveConversationSession(input: PersistedChatSessionInput) {
  return prisma.$transaction(async (transaction) => {
    const session = input.id
      ? await transaction.conversationSession.upsert({
          where: { id: input.id },
          update: {
            title: input.title,
          },
          create: {
            id: input.id,
            source: "loco",
            title: input.title,
          },
        })
      : await transaction.conversationSession.create({
          data: {
            source: "loco",
            title: input.title,
          },
        });

    await transaction.conversationMessage.deleteMany({
      where: { sessionId: session.id },
    });

    if (input.messages.length > 0) {
      await transaction.conversationMessage.createMany({
        data: input.messages.map((message, index) => ({
          sessionId: session.id,
          role: message.role,
          content: message.content,
          position: index,
        })),
      });
    }

    return transaction.conversationSession.findUniqueOrThrow({
      where: { id: session.id },
      include: {
        messages: {
          orderBy: { position: "asc" },
        },
      },
    });
  });
}

export async function deleteConversationSession(id: string) {
  return prisma.$transaction(async (transaction) => {
    await transaction.calendarEventMemory.updateMany({
      where: {
        source: "loco",
        sessionId: id,
      },
      data: {
        sessionId: null,
      },
    });

    await transaction.conversationMessage.deleteMany({
      where: { sessionId: id },
    });

    const result = await transaction.conversationSession.deleteMany({
      where: {
        id,
        source: "loco",
      },
    });

    return result.count > 0;
  });
}

export async function deleteAllConversationSessions() {
  await prisma.$transaction(async (transaction) => {
    await transaction.calendarEventMemory.updateMany({
      where: { source: "loco" },
      data: {
        sessionId: null,
      },
    });

    await transaction.conversationMessage.deleteMany({
      where: {
        session: {
          source: "loco",
        },
      },
    });

    await transaction.conversationSession.deleteMany({
      where: { source: "loco" },
    });
  });
}

export async function rememberCalendarEvent(input: {
  googleEventId?: string | null;
  sessionId?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  startIso: string;
  endIso: string;
  timeZone: string;
  htmlLink?: string | null;
  rawRequest?: string | null;
}) {
  if (input.googleEventId) {
    return prisma.calendarEventMemory.upsert({
      where: { googleEventId: input.googleEventId },
      update: {
        sessionId: input.sessionId ?? null,
        title: input.title,
        description: input.description ?? null,
        location: input.location ?? null,
        startIso: new Date(input.startIso),
        endIso: new Date(input.endIso),
        timeZone: input.timeZone,
        htmlLink: input.htmlLink ?? null,
        rawRequest: input.rawRequest ?? null,
      },
      create: {
        source: "loco",
        googleEventId: input.googleEventId,
        sessionId: input.sessionId ?? null,
        title: input.title,
        description: input.description ?? null,
        location: input.location ?? null,
        startIso: new Date(input.startIso),
        endIso: new Date(input.endIso),
        timeZone: input.timeZone,
        htmlLink: input.htmlLink ?? null,
        rawRequest: input.rawRequest ?? null,
      },
    });
  }

  return prisma.calendarEventMemory.create({
    data: {
      source: "loco",
      sessionId: input.sessionId ?? null,
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      startIso: new Date(input.startIso),
      endIso: new Date(input.endIso),
      timeZone: input.timeZone,
      htmlLink: input.htmlLink ?? null,
      rawRequest: input.rawRequest ?? null,
    },
  });
}

export async function listRememberedCalendarEvents(limit = 10) {
  return prisma.calendarEventMemory.findMany({
    where: { source: "loco" },
    orderBy: { startIso: "desc" },
    take: limit,
  });
}

export async function deleteRememberedCalendarEventsByGoogleIds(googleEventIds: string[]) {
  const ids = googleEventIds.filter(Boolean);

  if (ids.length === 0) {
    return { count: 0 };
  }

  return prisma.calendarEventMemory.deleteMany({
    where: {
      source: "loco",
      googleEventId: {
        in: ids,
      },
    },
  });
}

export async function buildPersistentMemoryContext() {
  const [recentSessions, recentEvents] = await Promise.all([
    prisma.conversationSession.findMany({
      where: { source: "loco" },
      include: {
        messages: {
          orderBy: { position: "desc" },
          take: 4,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.calendarEventMemory.findMany({
      where: { source: "loco" },
      orderBy: { startIso: "desc" },
      take: 6,
    }),
  ]);

  const sections: string[] = [];

  if (recentSessions.length > 0) {
    sections.push("Recent saved conversations:");
    for (const session of recentSessions) {
      const lastUser = session.messages.find((message) => message.role === "user");
      const lastAssistant = session.messages.find((message) => message.role === "assistant");
      const lines = [`- ${session.title} (${session.updatedAt.toISOString()})`];

      if (lastUser) {
        lines.push(`  Last user message: ${trimSnippet(lastUser.content, 140)}`);
      }

      if (lastAssistant) {
        lines.push(`  Last assistant reply: ${trimSnippet(lastAssistant.content, 140)}`);
      }

      sections.push(lines.join("\n"));
    }
  }

  if (recentEvents.length > 0) {
    sections.push("Remembered calendar events created through Loco:");
    for (const event of recentEvents) {
      sections.push(
        `- ${event.title} on ${event.startIso.toISOString()} (${event.timeZone})${event.location ? ` at ${event.location}` : ""}`
      );
    }
  }

  if (sections.length === 0) {
    return "";
  }

  return `\nPERSISTENT MEMORY:\n${sections.join("\n")}`;
}

export async function buildRelevantConversationContext(query: string, limit = 3) {
  const sessions = await prisma.conversationSession.findMany({
    where: { source: "loco" },
    include: {
      messages: {
        orderBy: { position: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });

  const candidates = sessions.flatMap((session) => {
    return session.messages
      .map((message, index) => {
        if (message.role !== "user") {
          return null;
        }

        const followingAssistant = session.messages.slice(index + 1).find((entry) => entry.role === "assistant");
        const combinedText = `${message.content}\n${followingAssistant?.content || ""}`;
        return {
          updatedAt: session.updatedAt,
          userText: message.content,
          assistantText: followingAssistant?.content || "",
          score: scoreMemoryRelevance(query, combinedText),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  });

  const relevant = candidates
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.updatedAt.getTime() - left.updatedAt.getTime();
    })
    .slice(0, limit);

  if (relevant.length === 0) {
    return {
      context: "",
      matches: [],
    } satisfies RelevantConversationResult;
  }

  return {
    context: `\nRelevant prior conversation context:\n${relevant
      .map((entry) => {
        const dateLabel = entry.updatedAt.toISOString().slice(0, 10);
        const userLine = trimSnippet(entry.userText, 150);
        const assistantLine = entry.assistantText ? trimSnippet(entry.assistantText, 120) : "";
        return `- ${dateLabel}: User mentioned \"${userLine}\"${assistantLine ? ` | You replied about: ${assistantLine}` : ""}`;
      })
      .join("\n")}`,
    matches: relevant.map((entry) => ({
      date: entry.updatedAt.toISOString().slice(0, 10),
      userText: trimSnippet(entry.userText, 150),
      assistantText: entry.assistantText ? trimSnippet(entry.assistantText, 120) : "",
    })),
  } satisfies RelevantConversationResult;
}