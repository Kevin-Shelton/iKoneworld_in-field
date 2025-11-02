import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    const language = formData.get("language") as string;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Forward to Verbum AI STT API
    const verbumFormData = new FormData();
    verbumFormData.append("audio", audioFile);
    if (language) {
      verbumFormData.append("language", language);
    }

    const response = await fetch(
      "https://api.verbum.ai/v1/speech-to-text",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.VERBUM_API_KEY}`,
        },
        body: verbumFormData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Verbum AI STT error:", errorText);
      return NextResponse.json(
        { error: "Speech recognition failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("STT API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
