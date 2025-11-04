import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  try {
    const { conversationId } = await request.json();

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 }
      );
    }

    // Calculate duration
    const { data: conversation, error: fetchError } = await supabaseAdmin
      .from("conversations")
      .select("created_at")
      .eq("id", conversationId)
      .single();

    if (fetchError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const createdAt = new Date(conversation.created_at);
    const now = new Date();
    const durationMs = now.getTime() - createdAt.getTime();
    const durationSeconds = Math.floor(durationMs / 1000);

    // Update conversation status to completed
    const { error: updateError } = await supabaseAdmin
      .from("conversations")
      .update({
        status: "completed",
        ended_at: now.toISOString(),
        duration: durationSeconds,
      })
      .eq("id", conversationId);

    if (updateError) {
      console.error("Error completing conversation:", updateError);
      return NextResponse.json(
        { error: "Failed to complete conversation" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Conversation completed",
    });
  } catch (error) {
    console.error("Error in complete endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
