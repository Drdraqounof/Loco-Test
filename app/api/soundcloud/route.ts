import { NextRequest, NextResponse } from "next/server";

const SOUNDCLOUD_CLIENT_ID = process.env.SOUNDCLOUD_CLIENT_ID;

interface SoundCloudTrackCandidate {
  title?: string;
  permalink_url?: string;
  created_at?: string;
  user?: {
    username?: string;
  };
}

function selectTrack(candidates: SoundCloudTrackCandidate[], newest = false) {
  const usable = candidates.filter((candidate) => Boolean(candidate?.title && candidate?.permalink_url));

  if (usable.length === 0) {
    return null;
  }

  if (!newest) {
    return usable[0];
  }

  return [...usable].sort((left, right) => {
    const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
    const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
    return rightTime - leftTime;
  })[0];
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode");

  if (!mode) {
    return NextResponse.json({
      configured: Boolean(SOUNDCLOUD_CLIENT_ID),
    });
  }

  if (!SOUNDCLOUD_CLIENT_ID) {
    return NextResponse.json(
      {
        error: "SoundCloud is not configured yet. Add SOUNDCLOUD_CLIENT_ID to your environment.",
      },
      { status: 400 }
    );
  }

  if (mode !== "track") {
    return NextResponse.json({ error: "Unsupported SoundCloud mode." }, { status: 400 });
  }

  const query = request.nextUrl.searchParams.get("query")?.trim();
  const newest = request.nextUrl.searchParams.get("newest") === "true";

  if (!query) {
    return NextResponse.json({ error: "Track query is required." }, { status: 400 });
  }

  const apiUrl = new URL("https://api-v2.soundcloud.com/search/tracks");
  apiUrl.searchParams.set("q", query);
  apiUrl.searchParams.set("client_id", SOUNDCLOUD_CLIENT_ID);
  apiUrl.searchParams.set("limit", "20");

  try {
    const response = await fetch(apiUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `SoundCloud search failed: ${response.status} ${text}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const collection = Array.isArray(data?.collection) ? data.collection as SoundCloudTrackCandidate[] : [];
    const track = selectTrack(collection, newest);

    if (!track?.permalink_url || !track.title) {
      return NextResponse.json({ error: `No SoundCloud tracks matched "${query}".` }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      track: {
        title: track.title,
        permalinkUrl: track.permalink_url,
        artist: track.user?.username || "Unknown artist",
        createdAt: track.created_at || null,
      },
    });
  } catch (error) {
    console.error("SoundCloud API error:", error);
    return NextResponse.json({ error: "Unable to reach SoundCloud right now." }, { status: 502 });
  }
}