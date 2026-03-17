import { NextRequest, NextResponse } from "next/server";

// In plain terms: this route starts the Google Calendar sign-in flow.
import {
  createOAuthClient,
  getGoogleCalendarScopes,
} from "@/lib/googleCalendar";

export async function GET(request: NextRequest) {
  try {
    const state = crypto.randomUUID();
    const auth = createOAuthClient(request.nextUrl.origin);
    const url = auth.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: getGoogleCalendarScopes(),
      state,
    });

    const response = NextResponse.redirect(url);
    response.cookies.set("google_calendar_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    console.error("Google Calendar connect error:", error);
    return NextResponse.redirect(new URL("/settings?googleCalendar=error", request.nextUrl.origin));
  }
}