import { NextResponse } from "next/server";
import { getFavoriteLanguages } from "@/lib/db";

export async function GET() {
  try {
    const languages = await getFavoriteLanguages();
    return NextResponse.json(languages);
  } catch (error) {
    console.error("Error fetching favorite languages:", error);
    return NextResponse.json(
      { error: "Failed to fetch favorite languages" },
      { status: 500 }
    );
  }
}
