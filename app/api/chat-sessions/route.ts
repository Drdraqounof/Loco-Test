import { NextRequest, NextResponse } from "next/server";

// In plain terms: this route lists or clears saved chat sessions.
import {
  deleteAllConversationSessions,
  PersistedChatMessageInput,
  listConversationSessions,
  saveConversationSession,
} from "@/lib/chatMemory";

interface ChatSessionRequestBody {
  id?: string;
  title?: string;
  messages?: PersistedChatMessageInput[];
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
  const sessions = await listConversationSessions();
  return NextResponse.json({
    sessions: sessions.map(toResponseSession),
  });
}

export async function DELETE() {
  await deleteAllConversationSessions();
  return NextResponse.json({ success: true });
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

  const session = await saveConversationSession({
    id: typeof body.id === "string" ? body.id : undefined,
    title: body.title.trim(),
    messages,
  });

  return NextResponse.json({
    session: toResponseSession(session),
  });
}