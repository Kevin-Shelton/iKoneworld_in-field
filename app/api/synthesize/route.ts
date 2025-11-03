import { NextRequest, NextResponse } from "next/server";

interface SynthesizeRequestBody {
  voice: string;
  text: string;
  audioFormat?: string;
  model?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SynthesizeRequestBody;
    const { voice, text, audioFormat = "Audio16Khz128KBitMp3", model = "default" } = body;

    // Validate request body
    if (!voice || typeof voice !== "string") {
      return NextResponse.json({ error: "Invalid request: voice is required" }, { status: 400 });
    }

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Invalid request: text is required" }, { status: 400 });
    }

    // Check if API key is configured
    if (!process.env.VERBUM_API_KEY) {
      return NextResponse.json({ error: "TTS service not configured" }, { status: 500 });
    }

    const response = await fetch("https://sdk.verbum.ai/v1/speech/synthesize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.VERBUM_API_KEY!,
      },
      body: JSON.stringify({
        voice,
        text,
        audioFormat,
        model,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("TTS API error:", response.status, errorText);
      return NextResponse.json(
        {
          error: "TTS service error",
          details: errorText,
        },
        { status: response.status }
      );
    }

    // Stream the audio response back to the client
    const audioBuffer = await response.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json(
      {
        error: "Failed to synthesize speech",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
