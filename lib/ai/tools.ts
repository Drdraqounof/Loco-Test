import { listConversationSessions, listRememberedCalendarEvents } from "@/lib/chatMemory";
import { listRememberedYouTubePlaybacks } from "@/lib/youtubeMemory";
import { getStoredCalendarConnection } from "@/lib/googleCalendar";
import { getStoredYouTubeConnection } from "@/lib/youtubeOAuth";
import { listWorkforceMembers, listWorkforceAreas } from "@/lib/workforce";

// In plain terms: tool-style data accessors so the orchestrator fetches only needed records instead of dumping the DB into prompts.

export const AI_TOOLS = {
  searchChatSessions: async (limit = 10) => {
    const sessions = await listConversationSessions();
    return sessions.slice(0, limit).map((session) => ({
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt,
      messageCount: session.messages.length,
    }));
  },

  listCalendarMemories: async (limit = 20) => {
    const events = await listRememberedCalendarEvents();
    return events.slice(0, limit).map((event) => ({
      id: event.id,
      title: event.title,
      startIso: event.startIso,
      endIso: event.endIso,
      timeZone: event.timeZone,
      location: event.location,
    }));
  },

  getCalendarConnectionStatus: async () => {
    const connection = await getStoredCalendarConnection();
    return {
      connected: Boolean(connection),
      email: connection?.email ?? null,
    };
  },

  getYouTubeConnectionStatus: async () => {
    const connection = await getStoredYouTubeConnection();
    return {
      connected: Boolean(connection),
      email: connection?.email ?? null,
      channelTitle: connection?.channelTitle ?? null,
    };
  },

  listYouTubePlaybackMemories: async (limit = 10) => {
    const listens = await listRememberedYouTubePlaybacks();
    return listens.slice(0, limit);
  },

  listWorkforceSummary: async () => {
    const [members, areas] = await Promise.all([listWorkforceMembers(), listWorkforceAreas()]);
    return {
      memberCount: members.length,
      areaCount: areas.length,
      areas: areas.map((area) => ({
        code: area.code,
        title: area.title,
        competencyCount: area.competencies.length,
      })),
    };
  },
} as const;

export type AiToolName = keyof typeof AI_TOOLS;
