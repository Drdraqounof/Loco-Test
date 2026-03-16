import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createYouTubeOAuthClient, saveYouTubeConnection } from "@/lib/youtubeOAuth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get("youtube_oauth_state")?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/settings?youtube=invalid-state", request.nextUrl.origin));
  }

  try {
    const auth = createYouTubeOAuthClient(request.nextUrl.origin);
    const { tokens } = await auth.getToken(code);
    auth.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth });
    const youtube = google.youtube({ version: "v3", auth });
    const [profile, channels] = await Promise.all([
      oauth2.userinfo.get(),
      youtube.channels.list({
        mine: true,
        part: ["snippet"],
        maxResults: 1,
      }),
    ]);

    const firstChannel = channels.data.items?.[0];

    await saveYouTubeConnection({
      accessToken: tokens.access_token || "",
      refreshToken: tokens.refresh_token || null,
      expiryDate: tokens.expiry_date || null,
      scope: tokens.scope || null,
      email: profile.data.email || null,
      channelId: firstChannel?.id || null,
      channelTitle: firstChannel?.snippet?.title || null,
    });

    const response = NextResponse.redirect(new URL("/settings?youtube=connected", request.nextUrl.origin));
    response.cookies.delete("youtube_oauth_state");
    return response;
  } catch (error) {
    console.error("YouTube callback error:", error);
    const response = NextResponse.redirect(new URL("/settings?youtube=error", request.nextUrl.origin));
    response.cookies.delete("youtube_oauth_state");
    return response;
  }
}