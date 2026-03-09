import { google } from "googleapis";
import { deleteRememberedCalendarEventsByGoogleIds, rememberCalendarEvent } from "@/lib/chatMemory";
import { prisma } from "@/lib/prisma";

const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
];

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getGoogleOAuthConfig(origin?: string) {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || `${origin || requireEnv("APP_URL")}/api/google-calendar/callback`;

  return { clientId, clientSecret, redirectUri };
}

export function createOAuthClient(origin?: string) {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig(origin);
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleCalendarScopes() {
  return [...GOOGLE_CALENDAR_SCOPES];
}

export async function getStoredCalendarConnection() {
  return prisma.googleCalendarConnection.findUnique({
    where: { provider: "google" },
  });
}

export async function saveCalendarConnection(params: {
  accessToken: string;
  refreshToken?: string | null;
  expiryDate?: number | null;
  scope?: string | null;
  email?: string | null;
}) {
  return prisma.googleCalendarConnection.upsert({
    where: { provider: "google" },
    update: {
      accessToken: params.accessToken,
      refreshToken: params.refreshToken ?? undefined,
      expiryDate: params.expiryDate ? BigInt(params.expiryDate) : null,
      scope: params.scope ?? null,
      email: params.email ?? null,
    },
    create: {
      provider: "google",
      accessToken: params.accessToken,
      refreshToken: params.refreshToken ?? null,
      expiryDate: params.expiryDate ? BigInt(params.expiryDate) : null,
      scope: params.scope ?? null,
      email: params.email ?? null,
    },
  });
}

export async function deleteCalendarConnection() {
  await prisma.googleCalendarConnection.deleteMany({
    where: { provider: "google" },
  });
}

export async function getAuthorizedCalendarClient(origin?: string) {
  const connection = await getStoredCalendarConnection();
  if (!connection) {
    return null;
  }

  const oauth2Client = createOAuthClient(origin);
  oauth2Client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken || undefined,
    expiry_date: connection.expiryDate ? Number(connection.expiryDate) : undefined,
    scope: connection.scope || undefined,
  });

  if (!connection.refreshToken) {
    return {
      auth: oauth2Client,
      calendar: google.calendar({ version: "v3", auth: oauth2Client }),
      connection,
    };
  }

  const expiresSoon =
    !connection.expiryDate || Number(connection.expiryDate) - Date.now() < 60_000;

  if (expiresSoon) {
    const refreshed = await oauth2Client.refreshAccessToken();
    const credentials = refreshed.credentials;
    if (credentials.access_token) {
      await saveCalendarConnection({
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || connection.refreshToken,
        expiryDate: credentials.expiry_date || null,
        scope: credentials.scope || connection.scope,
        email: connection.email,
      });
      oauth2Client.setCredentials({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || connection.refreshToken || undefined,
        expiry_date: credentials.expiry_date || undefined,
        scope: credentials.scope || connection.scope || undefined,
      });
    }
  }

  return {
    auth: oauth2Client,
    calendar: google.calendar({ version: "v3", auth: oauth2Client }),
    connection,
  };
}

export async function createCalendarEvent(input: {
  title: string;
  description?: string | null;
  location?: string | null;
  startIso: string;
  endIso: string;
  timeZone: string;
  origin?: string;
  rawRequest?: string | null;
  sessionId?: string | null;
}) {
  const client = await getAuthorizedCalendarClient(input.origin);
  if (!client) {
    throw new Error("Google Calendar is not connected");
  }

  const event = await client.calendar.events.insert({
    calendarId: client.connection.calendarId,
    requestBody: {
      summary: input.title,
      description: input.description || undefined,
      location: input.location || undefined,
      start: {
        dateTime: input.startIso,
        timeZone: input.timeZone,
      },
      end: {
        dateTime: input.endIso,
        timeZone: input.timeZone,
      },
    },
  });

  await rememberCalendarEvent({
    googleEventId: event.data.id || null,
    sessionId: input.sessionId ?? null,
    title: input.title,
    description: input.description,
    location: input.location,
    startIso: input.startIso,
    endIso: input.endIso,
    timeZone: input.timeZone,
    htmlLink: event.data.htmlLink || null,
    rawRequest: input.rawRequest ?? null,
  });

  return event.data;
}

export interface GoogleCalendarEventSummary {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  htmlLink?: string | null;
  status?: string | null;
  startIso: string | null;
  endIso: string | null;
  isAllDay: boolean;
}

function mapGoogleEvent(event: {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  htmlLink?: string | null;
  status?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
}): GoogleCalendarEventSummary | null {
  if (!event.id) {
    return null;
  }

  return {
    id: event.id,
    title: event.summary || "Untitled event",
    description: event.description || null,
    location: event.location || null,
    htmlLink: event.htmlLink || null,
    status: event.status || null,
    startIso: event.start?.dateTime || event.start?.date || null,
    endIso: event.end?.dateTime || event.end?.date || null,
    isAllDay: Boolean(event.start?.date && !event.start?.dateTime),
  };
}

export async function listCalendarEvents(input: {
  startIso: string;
  endIso: string;
  origin?: string;
  query?: string;
  limit?: number;
}) {
  const client = await getAuthorizedCalendarClient(input.origin);
  if (!client) {
    throw new Error("Google Calendar is not connected");
  }

  const response = await client.calendar.events.list({
    calendarId: client.connection.calendarId,
    timeMin: input.startIso,
    timeMax: input.endIso,
    singleEvents: true,
    orderBy: "startTime",
    q: input.query || undefined,
    maxResults: input.limit ?? 100,
  });

  return (response.data.items || [])
    .map((event) => mapGoogleEvent(event))
    .filter((event): event is GoogleCalendarEventSummary => Boolean(event));
}

export async function deleteCalendarEvents(input: {
  eventIds: string[];
  origin?: string;
}) {
  const client = await getAuthorizedCalendarClient(input.origin);
  if (!client) {
    throw new Error("Google Calendar is not connected");
  }

  const eventIds = input.eventIds.filter(Boolean);
  if (eventIds.length === 0) {
    return { deletedCount: 0 };
  }

  for (const eventId of eventIds) {
    await client.calendar.events.delete({
      calendarId: client.connection.calendarId,
      eventId,
    });
  }

  await deleteRememberedCalendarEventsByGoogleIds(eventIds);

  return {
    deletedCount: eventIds.length,
  };
}