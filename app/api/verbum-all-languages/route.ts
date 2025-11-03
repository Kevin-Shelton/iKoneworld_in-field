import { NextResponse } from "next/server";

/**
 * Fetch all supported languages from Verbum AI for STT, TTS, and Translation
 * This will help us align the database with official Verbum AI support
 */
export async function GET() {
  try {
    if (!process.env.VERBUM_API_KEY) {
      return NextResponse.json(
        { error: "VERBUM_API_KEY not configured" },
        { status: 500 }
      );
    }

    const apiKey = process.env.VERBUM_API_KEY!;

    // Fetch all three language lists in parallel
    const [translatorRes, sttRes, ttsRes] = await Promise.all([
      // Translation languages
      fetch("https://sdk.verbum.ai/v1/translator/languages", {
        headers: { "x-api-key": apiKey },
      }),
      // STT languages
      fetch("https://sdk.verbum.ai/v1/stt/languages", {
        headers: { "x-api-key": apiKey },
      }),
      // TTS voices
      fetch("https://sdk.verbum.ai/v1/tts/voices", {
        headers: { "x-api-key": apiKey },
      }),
    ]);

    const results: any = {
      translation: { success: translatorRes.ok },
      stt: { success: sttRes.ok },
      tts: { success: ttsRes.ok },
    };

    // Process Translation languages
    if (translatorRes.ok) {
      const translationLangs = await translatorRes.json();
      results.translation.languages = translationLangs;
      results.translation.count = Object.keys(translationLangs).length;
      
      // Count regional variants
      const regionalVariants = Object.keys(translationLangs).filter(code => code.includes('-'));
      results.translation.regionalVariants = regionalVariants;
      results.translation.regionalCount = regionalVariants.length;
    } else {
      results.translation.error = await translatorRes.text();
    }

    // Process STT languages
    if (sttRes.ok) {
      const sttLangs = await sttRes.json();
      results.stt.languages = sttLangs;
      results.stt.count = Array.isArray(sttLangs) ? sttLangs.length : Object.keys(sttLangs).length;
      
      // Extract language codes
      if (Array.isArray(sttLangs)) {
        const codes = sttLangs.map((l: any) => l.code || l.language || l);
        results.stt.codes = codes;
        results.stt.regionalCount = codes.filter((c: string) => c.includes('-')).length;
      }
    } else {
      results.stt.error = await sttRes.text();
    }

    // Process TTS voices
    if (ttsRes.ok) {
      const ttsVoices = await ttsRes.json();
      results.tts.voices = ttsVoices;
      results.tts.count = Array.isArray(ttsVoices) ? ttsVoices.length : Object.keys(ttsVoices).length;
      
      // Extract unique language codes from voices
      if (Array.isArray(ttsVoices)) {
        const languageCodes = [...new Set(ttsVoices.map((v: any) => v.language || v.locale))];
        results.tts.languageCodes = languageCodes;
        results.tts.languageCount = languageCodes.length;
        results.tts.regionalCount = languageCodes.filter((c: string) => c && c.includes('-')).length;
      }
    } else {
      results.tts.error = await ttsRes.text();
    }

    console.log('[Verbum All Languages] Fetched:', {
      translation: results.translation.count,
      stt: results.stt.count,
      tts: results.tts.count,
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching Verbum languages:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch languages",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
