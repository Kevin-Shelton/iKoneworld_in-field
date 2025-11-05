import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/chat/create
 * Creates a new chat conversation for customer (no authentication required)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { language1 = "en", language2 = "es" } = body;

    // Create conversation without userId (customer-initiated)
    // We'll use a placeholder userId or create a guest user system
    const { data: conversation, error } = await supabaseAdmin
      .from("conversations")
      .insert({
        userId: 0, // Placeholder for guest/customer conversations
        language1,
        language2,
        status: "active",
        metadata: { 
          is_demo: true, 
          conversation_type: "chat",
          employee_name: "Customer Service",
          initiated_by: "customer",
          session_id: null // Will be set to conversation.id after insert
        },
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("[Chat Create] Database error:", error);
      return NextResponse.json(
        { error: "Failed to create conversation" },
        { status: 500 }
      );
    }

    // Update metadata with session_id
    await supabaseAdmin
      .from("conversations")
      .update({
        metadata: {
          ...conversation.metadata,
          session_id: conversation.id.toString()
        }
      })
      .eq("id", conversation.id);

    return NextResponse.json({
      conversationId: conversation.id,
      success: true,
    });
  } catch (error) {
    console.error("[Chat Create] Error:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
