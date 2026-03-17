import { NextRequest, NextResponse } from "next/server";

// In plain terms: this route starts the YouTube sign-in flow.
import { createYouTubeOAuthClient, getYouTubeScopes } from "@/lib/youtubeOAuth";

export async function GET(request: NextRequest) {
  try {
    const state = crypto.randomUUID();
    const auth = createYouTubeOAuthClient(request.nextUrl.origin);
    const url = auth.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: getYouTubeScopes(),
      state,
    });

    const response = NextResponse.redirect(url);
    response.cookies.set("youtube_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    console.error("YouTube connect error:", error);
    return NextResponse.redirect(new URL("/settings?youtube=error", request.nextUrl.origin));
  }
}