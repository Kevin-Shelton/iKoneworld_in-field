import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations } from "@/drizzle/schema";
import QRCode from "qrcode";

/**
 * POST /api/demo/start
 * Creates a new demo conversation and returns QR code + URL
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, language1, language2 } = body;

    if (!userId || !language1 || !language2) {
      return NextResponse.json(
        { error: "Missing required fields: userId, language1, language2" },
        { status: 400 }
      );
    }

    // Create demo conversation with metadata
    const [conversation] = await db
      .insert(conversations)
      .values({
        userId,
        language1,
        language2,
        status: "active",
        metadata: { is_demo: true },
      })
      .returning();

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
