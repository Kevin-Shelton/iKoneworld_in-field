import { NextRequest, NextResponse } from "next/server";

interface TranslateRequestBody {
  texts: Array<{ text: string }>;
  from: string;
  to: string[];
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

    const response = await fetch("https://sdk.verbum.ai/v1/translator/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        texts,
        from,
        to,
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
