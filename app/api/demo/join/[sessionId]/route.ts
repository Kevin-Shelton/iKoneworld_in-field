import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { conversations, conversationMessages } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/demo/join/[sessionId]
 * Retrieves conversation details and messages for a demo session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const conversationId = parseInt(sessionId, 10);

    if (isNaN(conversationId)) {
      return NextResponse.json(
        { error: "Invalid session ID" },
        { status: 400 }
      );
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 500 }
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
