import { NextRequest, NextResponse } from "next/server";

interface SentimentRequestBody {
  texts: string[];
  language: string;
}

interface SentimentResponse {
  id: string;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  confidenceScores: {
    positive: number;
    neutral: number;
    negative: number;
  };
  text: string;
}

/**
 * Map our detailed language codes (e.g., en-US, es-CR) to Verbum AI's format
 * Verbum AI uses mostly 2-letter codes
 */
function mapToVerbumLanguageCode(code: string): string {
  // For sentiment analysis, just take the first 2 letters (en-US -> en, es-CR -> es)
  const baseCode = code.split('-')[0].toLowerCase();
  return baseCode;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SentimentRequestBody;
    const { texts, language } = body;

    // Validate request body
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: texts array is required" },
        { status: 400 }
      );
    }

    if (!language || typeof language !== "string") {
      return NextResponse.json(
        { error: "Invalid request: language is required" },
        { status: 400 }
      );
    }

    // Check if API key is configured
    const apiKey = process.env.VERBUM_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "Sentiment analysis service not configured" },
        { status: 500 }
      );
    }

    // Map language code to Verbum AI format
    const mappedLanguage = mapToVerbumLanguageCode(language);

    console.log('[Sentiment API] Analyzing sentiment for', texts.length, 'texts in language:', mappedLanguage);

    const response = await fetch("https://sdk.verbum.ai/v1/text-analysis/sentiment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        texts,
        language: mappedLanguage,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sentiment API error:", response.status, errorText);
      return NextResponse.json(
        {
          error: "Sentiment analysis service error",
          details: errorText,
        },
        { status: response.status }
      );
    }

    const data: SentimentResponse[] = await response.json();
    console.log('[Sentiment API] Results:', data.map(d => ({ text: d.text.substring(0, 50), sentiment: d.sentiment })));
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("Sentiment analysis error:", error);
    return NextResponse.json(
      {
        error: "Failed to analyze sentiment",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
