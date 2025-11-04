import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

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
    const { data: message, error } = await supabaseAdmin
      .from("conversation_messages")
      .insert({
        conversationId,
        speaker,
        original_text: content,
        translated_text: translatedText,
        source_language: sourceLang,
        target_language: targetLang,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("[Demo Message] Database error:", error);
      return NextResponse.json(
        { error: "Failed to save message" },
        { status: 500 }
      );
    }

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
