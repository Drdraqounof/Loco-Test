import { NextRequest, NextResponse } from "next/server";

// In plain terms: this route finishes Google Calendar sign-in and stores the user's calendar access tokens.
import { google } from "googleapis";
import {
  createOAuthClient,
  saveCalendarConnection,
} from "@/lib/googleCalendar";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get("google_calendar_oauth_state")?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/settings?googleCalendar=invalid-state", request.nextUrl.origin));
  }

  try {
    const auth = createOAuthClient(request.nextUrl.origin);
    const { tokens } = await auth.getToken(code);
    auth.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth });
    const profile = await oauth2.userinfo.get();

    await saveCalendarConnection({
      accessToken: tokens.access_token || "",
      refreshToken: tokens.refresh_token || null,
      expiryDate: tokens.expiry_date || null,
      scope: tokens.scope || null,
      email: profile.data.email || null,
    });

    const response = NextResponse.redirect(new URL("/settings?googleCalendar=connected", request.nextUrl.origin));
    response.cookies.delete("google_calendar_oauth_state");
    return response;
  } catch (error) {
    console.error("Google Calendar callback error:", error);
    const response = NextResponse.redirect(new URL("/settings?googleCalendar=error", request.nextUrl.origin));
    response.cookies.delete("google_calendar_oauth_state");
    return response;
  }
}