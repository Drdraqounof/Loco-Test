import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

// In plain terms: this route lists or clears saved chat sessions.
import {
  deleteAllConversationSessions,
  PersistedChatMessageInput,
  listConversationSessions,
  saveConversationSession,
} from "@/lib/chatMemory";
import { isPersistenceUnavailableError } from "@/lib/persistence";

interface ChatSessionRequestBody {
  id?: string;
  title?: string;
  messages?: PersistedChatMessageInput[];
}

function isRecoverableChatPersistenceError(error: unknown) {
  if (isPersistenceUnavailableError(error)) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P1017" || error.code === "P2021" || error.code === "P2022";
  }

  return error instanceof Prisma.PrismaClientUnknownRequestError || error instanceof Prisma.PrismaClientRustPanicError;
}

function toResponseSession(session: Awaited<ReturnType<typeof listConversationSessions>>[number]) {
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    messages: session.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  };
}

export async function GET() {
  try {
    const sessions = await listConversationSessions();
    return NextResponse.json({
      sessions: sessions.map(toResponseSession),
    });
  } catch (error) {
    if (isRecoverableChatPersistenceError(error)) {
      console.warn("Chat session persistence unavailable; returning empty session list.", error);
      return NextResponse.json({
        sessions: [],
        persistenceUnavailable: true,
      });
    }

    throw error;
  }
}

export async function DELETE() {
  try {
    await deleteAllConversationSessions();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isRecoverableChatPersistenceError(error)) {
      return NextResponse.json({ success: false, error: "Chat history persistence is unavailable" }, { status: 503 });
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ChatSessionRequestBody;
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (typeof body.title !== "string" || body.title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  if (!messages.every((message: PersistedChatMessageInput) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string")) {
    return NextResponse.json({ error: "Messages must be an array of user/assistant messages" }, { status: 400 });
  }

  try {
    const session = await saveConversationSession({
      id: typeof body.id === "string" ? body.id : undefined,
      title: body.title.trim(),
      messages,
    });

    return NextResponse.json({
      session: toResponseSession(session),
    });
  } catch (error) {
    if (isRecoverableChatPersistenceError(error)) {
      return NextResponse.json({ error: "Chat history persistence is unavailable" }, { status: 503 });
    }

    throw error;
  }
}