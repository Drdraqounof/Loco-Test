import { NextRequest, NextResponse } from "next/server";
import { deleteConversationSession } from "@/lib/chatMemory";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Session id is required" }, { status: 400 });
  }

  await deleteConversationSession(id);
  return NextResponse.json({ success: true });
}