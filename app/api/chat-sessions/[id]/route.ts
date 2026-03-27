import { NextRequest, NextResponse } from "next/server";

// In plain terms: this route deletes one specific saved chat session.
import { isPersistenceUnavailableError } from "@/lib/persistence";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Session id is required" }, { status: 400 });
  }

  try {
    const { deleteConversationSession } = await import("@/lib/chatMemory");
    await deleteConversationSession(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isPersistenceUnavailableError(error)) {
      return NextResponse.json({ success: false, error: "Chat history persistence is unavailable" }, { status: 503 });
    }

    throw error;
  }
}