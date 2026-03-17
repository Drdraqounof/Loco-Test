import { NextResponse } from "next/server";

// In plain terms: this route reports Google Calendar connection status and lets the app manage that integration.
import {
  deleteCalendarConnection,
  getStoredCalendarConnection,
  getGoogleOAuthConfig,
} from "@/lib/googleCalendar";

function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && (process.env.GOOGLE_REDIRECT_URI || process.env.APP_URL));
}

export async function GET() {
  const configured = isConfigured();

  if (!configured) {
    return NextResponse.json({
      configured: false,
      connected: false,
      email: null,
    });
  }

  const connection = await getStoredCalendarConnection();
  let redirectUri: string | null = null;

  try {
    redirectUri = getGoogleOAuthConfig().redirectUri;
  } catch {
    redirectUri = null;
  }

  return NextResponse.json({
    configured: true,
    connected: Boolean(connection),
    email: connection?.email ?? null,
    redirectUri,
  });
}

export async function DELETE() {
  await deleteCalendarConnection();
  return NextResponse.json({ success: true });
}