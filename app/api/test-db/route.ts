import { NextResponse } from "next/server";
import { getAllLanguages } from "@/lib/db";

export async function GET() {
  try {
    console.log("[TEST-DB] Starting database test...");
    console.log("[TEST-DB] DATABASE_URL exists:", !!process.env.DATABASE_URL);
    console.log("[TEST-DB] DATABASE_URL length:", process.env.DATABASE_URL?.length || 0);
    
    const languages = await getAllLanguages();
    
    console.log("[TEST-DB] Languages fetched:", languages.length);
    
    return NextResponse.json({
      success: true,
      hasDbUrl: !!process.env.DATABASE_URL,
      dbUrlLength: process.env.DATABASE_URL?.length || 0,
      languageCount: languages.length,
      sampleLanguages: languages.slice(0, 3),
      message: "Database connection test successful"
    });
  } catch (error) {
    console.error("[TEST-DB] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      hasDbUrl: !!process.env.DATABASE_URL,
    }, { status: 500 });
  }
}
