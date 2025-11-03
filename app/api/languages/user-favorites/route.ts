import { NextRequest, NextResponse } from "next/server";
import { getUserFavoriteLanguages, addUserFavoriteLanguage, removeUserFavoriteLanguage } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }
    
    const languages = await getUserFavoriteLanguages(parseInt(userId));
    return NextResponse.json(languages);
  } catch (error) {
    console.error("Error fetching user favorite languages:", error);
    return NextResponse.json(
      { error: "Failed to fetch user favorite languages" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, languageCode } = body;
    
    if (!userId || !languageCode) {
      return NextResponse.json(
        { error: "userId and languageCode are required" },
        { status: 400 }
      );
    }
    
    await addUserFavoriteLanguage(parseInt(userId), languageCode);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding favorite language:", error);
    return NextResponse.json(
      { error: "Failed to add favorite language" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, languageCode } = body;
    
    if (!userId || !languageCode) {
      return NextResponse.json(
        { error: "userId and languageCode are required" },
        { status: 400 }
      );
    }
    
    await removeUserFavoriteLanguage(parseInt(userId), languageCode);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing favorite language:", error);
    return NextResponse.json(
      { error: "Failed to remove favorite language" },
      { status: 500 }
    );
  }
}
