import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversationMessages } from "@/drizzle/schema";

/**
 * POST /api/demo/message
 * Sends a message in a demo conversation with automatic translation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      conversationId,
      content,
      senderName,
      senderRole,
      sourceLang,
      targetLang,
    } = body;

    if (!conversationId || !content || !senderRole || !sourceLang || !targetLang) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Translate the message using Verbum API
    const verbumApiKey = process.env.VERBUM_API_KEY;
    if (!verbumApiKey) {
      return NextResponse.json(
        { error: "Translation service not configured" },
        { status: 500 }
      );
    }

    const translateResponse = await fetch(
      "https://sdk.verbum.ai/v1/translator/translate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": verbumApiKey,
        },
        body: JSON.stringify({
          texts: [{ text: content }],
          from: sourceLang,
          to: [targetLang],
        }),
      }
    );

    if (!translateResponse.ok) {
      const errorText = await translateResponse.text();
      console.error("[Translation] Error:", errorText);
      return NextResponse.json(
        { error: "Translation failed" },
        { status: 500 }
      );
    }

    const translateResult = await translateResponse.json();
    const translatedText =
      translateResult.translations?.[0]?.[0]?.text || content;

    // Store message with translation
    const speaker = senderRole === "employee" ? "user" : "guest";
    const [message] = await db
      .insert(conversationMessages)
      .values({
        conversationId,
        speaker,
        originalText: content,
        translatedText,
        language: sourceLang,
        confidence: 100, // Verbum API doesn't provide confidence, default to 100
      })
      .returning();

    return NextResponse.json({
      messageId: message.id,
      translation: translatedText,
    });
  } catch (error) {
    console.error("[Demo Message] Error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
