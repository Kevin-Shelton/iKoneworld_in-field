import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.VERBUM_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    return NextResponse.json({ apiKey });
  } catch (error) {
    console.error("Token API error:", error);
    return NextResponse.json(
      { error: "Failed to get API key" },
      { status: 500 }
    );
  }
}
