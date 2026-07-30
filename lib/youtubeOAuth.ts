import { google } from "googleapis";
import { resolveIntegrationUserId } from "@/lib/assistant/appUser";
import { prisma } from "@/lib/prisma";

// In plain terms: this file handles YouTube sign-in and token storage for the app.

const YOUTUBE_READONLY_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.readonly",
];

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getYouTubeOAuthConfig(origin?: string) {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri =
    process.env.YOUTUBE_REDIRECT_URI || `${origin || requireEnv("APP_URL")}/api/youtube/callback`;

  return { clientId, clientSecret, redirectUri };
}

export function createYouTubeOAuthClient(origin?: string) {
  const { clientId, clientSecret, redirectUri } = getYouTubeOAuthConfig(origin);
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getYouTubeScopes() {
  return [...YOUTUBE_READONLY_SCOPES];
}

export async function getStoredYouTubeConnection(userId?: number | null) {
  const resolvedUserId = await resolveIntegrationUserId(userId);
  return prisma.youTubeConnection.findUnique({
    where: {
      userId_provider: {
        userId: resolvedUserId,
        provider: "youtube",
      },
    },
  });
}

export async function saveYouTubeConnection(params: {
  accessToken: string;
  refreshToken?: string | null;
  expiryDate?: number | null;
  scope?: string | null;
  email?: string | null;
  channelId?: string | null;
  channelTitle?: string | null;
  userId?: number | null;
}) {
  const resolvedUserId = await resolveIntegrationUserId(params.userId);
  return prisma.youTubeConnection.upsert({
    where: {
      userId_provider: {
        userId: resolvedUserId,
        provider: "youtube",
      },
    },
    update: {
      accessToken: params.accessToken,
      refreshToken: params.refreshToken ?? undefined,
      expiryDate: params.expiryDate ? BigInt(params.expiryDate) : null,
      scope: params.scope ?? null,
      email: params.email ?? null,
      channelId: params.channelId ?? null,
      channelTitle: params.channelTitle ?? null,
    },
    create: {
      userId: resolvedUserId,
      provider: "youtube",
      accessToken: params.accessToken,
      refreshToken: params.refreshToken ?? null,
      expiryDate: params.expiryDate ? BigInt(params.expiryDate) : null,
      scope: params.scope ?? null,
      email: params.email ?? null,
      channelId: params.channelId ?? null,
      channelTitle: params.channelTitle ?? null,
    },
  });
}

export async function deleteYouTubeConnection(userId?: number | null) {
  const resolvedUserId = await resolveIntegrationUserId(userId);
  await prisma.youTubeConnection.deleteMany({
    where: {
      userId: resolvedUserId,
      provider: "youtube",
    },
  });
}

export async function getAuthorizedYouTubeClient(origin?: string) {
  const connection = await getStoredYouTubeConnection();
  if (!connection) {
    return null;
  }

  const auth = createYouTubeOAuthClient(origin);
  auth.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken || undefined,
    expiry_date: connection.expiryDate ? Number(connection.expiryDate) : undefined,
    scope: connection.scope || undefined,
  });

  if (connection.refreshToken) {
    const expiresSoon = !connection.expiryDate || Number(connection.expiryDate) - Date.now() < 60_000;

    if (expiresSoon) {
      const refreshed = await auth.refreshAccessToken();
      const credentials = refreshed.credentials;

      if (credentials.access_token) {
        await saveYouTubeConnection({
          accessToken: credentials.access_token,
          refreshToken: credentials.refresh_token || connection.refreshToken,
          expiryDate: credentials.expiry_date || null,
          scope: credentials.scope || connection.scope,
          email: connection.email,
          channelId: connection.channelId,
          channelTitle: connection.channelTitle,
        });

        auth.setCredentials({
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || connection.refreshToken || undefined,
          expiry_date: credentials.expiry_date || undefined,
          scope: credentials.scope || connection.scope || undefined,
        });
      }
    }
  }

  return {
    auth,
    youtube: google.youtube({ version: "v3", auth }),
    connection,
  };
}