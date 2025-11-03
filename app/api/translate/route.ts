import { NextRequest, NextResponse } from "next/server";

interface TranslateRequestBody {
  texts: Array<{ text: string }>;
  from: string;
  to: string[];
}

/**
 * Map our detailed language codes (e.g., en-US, es-CR) to Verbum AI's format
 * Verbum AI uses mostly 2-letter codes with some exceptions
 */
function mapToVerbumLanguageCode(code: string): string {
  // Special cases that Verbum AI uses specific codes for
  const specialCases: Record<string, string> = {
    'zh-CN': 'zh-Hans',  // Chinese Simplified
    'zh-TW': 'zh-Hant',  // Chinese Traditional
    'zh-HK': 'zh-Hant',  // Chinese Hong Kong -> Traditional
    'pt-PT': 'pt-pt',    // Portuguese Portugal
    'fr-CA': 'fr-ca',    // French Canada
    'mn-MN': 'mn-Cyrl',  // Mongolian Cyrillic
    'sr-RS': 'sr-Cyrl',  // Serbian Cyrillic
    'iu-CA': 'iu',       // Inuktitut
  };

  // Check if there's a special case mapping
  if (specialCases[code]) {
    return specialCases[code];
  }

  // For most languages, just take the first 2 letters (en-US -> en, es-CR -> es)
  const baseCode = code.split('-')[0].toLowerCase();
  return baseCode;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TranslateRequestBody;
    const { texts, from, to } = body;

    // Validate request body
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: texts array is required" },
        { status: 400 }
      );
    }

    if (!from || typeof from !== "string") {
      return NextResponse.json(
        { error: "Invalid request: from language is required" },
        { status: 400 }
      );
    }

    if (!to || !Array.isArray(to) || to.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: to languages array is required" },
        { status: 400 }
      );
    }

    // Check if API key is configured
    const apiKey = process.env.VERBUM_API_KEY;
    console.log('[Translation API] API Key present:', !!apiKey, 'Length:', apiKey?.length || 0);
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "Translation service not configured" },
        { status: 500 }
      );
    }

    // Map language codes to Verbum AI format
    const mappedFrom = mapToVerbumLanguageCode(from);
    const mappedTo = to.map(mapToVerbumLanguageCode);

    console.log('[Translation API] Mapping:', { original: { from, to }, mapped: { from: mappedFrom, to: mappedTo } });

    const response = await fetch("https://sdk.verbum.ai/v1/translator/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        texts,
        from: mappedFrom,
        to: mappedTo,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Translation API error:", response.status, errorText);
      return NextResponse.json(
        {
          error: "Translation service error",
          details: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      {
        error: "Failed to translate",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
