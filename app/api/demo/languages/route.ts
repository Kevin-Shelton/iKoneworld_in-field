import { NextResponse } from "next/server";

/**
 * GET /api/demo/languages
 * Returns list of supported languages from Verbum API
 */
export async function GET() {
  try {
    const verbumApiKey = process.env.VERBUM_API_KEY;
    if (!verbumApiKey) {
      return NextResponse.json(
        { error: "Translation service not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(
      "https://sdk.verbum.ai/v1/translator/languages",
      {
        method: "GET",
        headers: {
          "x-api-key": verbumApiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Languages] Error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch languages" },
        { status: 500 }
      );
    }

    const data = await response.json();

    // Convert the language object to an array
    const languages = Object.entries(data).map(([code, info]: [string, any]) => ({
      code,
      name: info.name,
      nativeName: info.nativeName,
      dir: info.dir,
    }));

    // Sort alphabetically by name
    languages.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(languages);
  } catch (error) {
    console.error("[Languages] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch supported languages" },
      { status: 500 }
    );
  }
}
