import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/providers/stt";

// In plain terms: this route turns uploaded audio into text so spoken requests can be used in the app.

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("file");

    if (!(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 }
      );
    }

    console.log(`[STT] Received audio blob: ${audioFile.size} bytes, type: ${audioFile.type}`);

    const result = await transcribeAudio(audioFile);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Transcription failed" },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      text: result.text,
      model: result.model,
    });
  } catch (error) {
    console.error("STT API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
