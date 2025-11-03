import { NextResponse } from "next/server";
import { getAllLanguages } from "@/lib/db";

export async function GET() {
  try {
    const languages = await getAllLanguages();
    // Return in format expected by profile page
    return NextResponse.json({ languages: languages || [] });
  } catch (error) {
    console.error("Error fetching languages:", error);
    return NextResponse.json(
      { error: "Failed to fetch languages", languages: [] },
      { status: 500 }
    );
  }
}
