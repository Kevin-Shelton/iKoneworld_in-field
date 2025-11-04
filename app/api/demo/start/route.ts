import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import QRCode from "qrcode";

/**
 * POST /api/demo/start
 * Creates a new demo conversation and returns QR code + URL
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, language1, language2, employeeName } = body;

    if (!userId || !language1 || !language2) {
      return NextResponse.json(
        { error: "Missing required fields: userId, language1, language2" },
        { status: 400 }
      );
    }

    // Create demo conversation with metadata
    const { data: conversation, error } = await supabaseAdmin
      .from("conversations")
      .insert({
        userId,
        language1,
        language2,
        status: "active",
        metadata: { 
          is_demo: true, 
          conversation_type: "demo",
          employee_name: employeeName || "Unknown",
          session_id: null // Will be set to conversation.id after insert
        },
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("[Demo Start] Database error:", error);
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

    // Generate customer URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const customerUrl = `${baseUrl}/chat/${conversation.id}`;

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(customerUrl, {
      width: 300,
      margin: 2,
    });

    return NextResponse.json({
      conversationId: conversation.id,
      customerUrl,
      qrCode: qrCodeDataUrl,
    });
  } catch (error) {
    console.error("[Demo Start] Error:", error);
    return NextResponse.json(
      { error: "Failed to start demo conversation" },
      { status: 500 }
    );
  }
}
