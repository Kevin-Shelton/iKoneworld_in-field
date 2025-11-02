import { NextRequest, NextResponse } from "next/server";
import { getAllTtsVoices, getTtsVoicesByLanguage } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const language = searchParams.get("language");

    if (language) {
      const voices = await getTtsVoicesByLanguage(language);
      return NextResponse.json(voices);
    }

    const voices = await getAllTtsVoices();
    return NextResponse.json(voices);
  } catch (error) {
    console.error("Error fetching TTS voices:", error);
    return NextResponse.json(
      { error: "Failed to fetch TTS voices" },
      { status: 500 }
    );
  }
}
