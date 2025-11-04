import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, conversationMessages } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/demo/join/[sessionId]
 * Retrieves conversation details and messages for a demo session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const conversationId = parseInt(params.sessionId, 10);

    if (isNaN(conversationId)) {
      return NextResponse.json(
        { error: "Invalid session ID" },
        { status: 400 }
      );
    }

    // Fetch conversation
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Fetch messages
    const messages = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(conversationMessages.timestamp);

    return NextResponse.json({
      conversation,
      messages,
    });
  } catch (error) {
    console.error("[Demo Join] Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve conversation" },
      { status: 500 }
    );
  }
}
