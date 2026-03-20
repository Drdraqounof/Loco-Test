import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { listRememberedYouTubePlaybacks, rememberYouTubePlayback, type RememberedYouTubeListen } from "@/lib/youtubeMemory";

function isPersistenceUnavailableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P1001" || error.code === "P1002";
  }

  return error instanceof Error && /can't reach database server|error in postgresql connection|closed/i.test(error.message);
}

function isValidRememberedYouTubeListen(value: unknown): value is RememberedYouTubeListen {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as RememberedYouTubeListen;
  return Boolean(
    typeof candidate.requestQuery === "string" &&
    typeof candidate.playedAt === "string" &&
    candidate.video &&
    typeof candidate.video.id === "string" &&
    typeof candidate.video.title === "string" &&
    typeof candidate.video.url === "string" &&
    typeof candidate.video.channel === "string"
  );
}

export async function GET() {
  try {
    const listens = await listRememberedYouTubePlaybacks();
    return NextResponse.json({ listens });
  } catch (error) {
    if (isPersistenceUnavailableError(error)) {
      return NextResponse.json({ listens: [], persistenceUnavailable: true });
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!isValidRememberedYouTubeListen(body)) {
    return NextResponse.json({ error: "Invalid YouTube playback memory payload" }, { status: 400 });
  }

  try {
    await rememberYouTubePlayback(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isPersistenceUnavailableError(error)) {
      return NextResponse.json({ error: "YouTube playback memory persistence is unavailable" }, { status: 503 });
    }

    throw error;
  }
}