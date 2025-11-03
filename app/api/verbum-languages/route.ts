import { NextResponse } from "next/server";

/**
 * Fetch the list of supported languages from Verbum AI
 * This will show us which language codes (including dialects) are actually supported
 */
export async function GET() {
  try {
    if (!process.env.VERBUM_API_KEY) {
      return NextResponse.json(
        { error: "VERBUM_API_KEY not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://sdk.verbum.ai/v1/translator/languages", {
      method: "GET",
      headers: {
        "x-api-key": process.env.VERBUM_API_KEY!,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Verbum languages API error:", response.status, errorText);
      return NextResponse.json(
        {
          error: "Failed to fetch supported languages",
          details: errorText,
        },
        { status: response.status }
      );
    }

    const languages = await response.json();
    
    // Filter to show only Spanish variants for debugging
    const spanishVariants = Object.keys(languages).filter(code => code.startsWith('es'));
    console.log('[Verbum Languages] Spanish variants found:', spanishVariants);
    
    return NextResponse.json({
      allLanguages: languages,
      spanishVariants,
      totalCount: Object.keys(languages).length,
    });
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
