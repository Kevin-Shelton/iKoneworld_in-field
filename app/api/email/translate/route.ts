import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

interface TranslateEmailRequestBody {
  messageId: string;
  targetLanguages: string[];
}

/**
 * Map our detailed language codes (e.g., en-US, es-CR) to Verbum AI's format
 * Verbum AI uses mostly 2-letter codes with some exceptions
 */
function mapToVerbumLanguageCode(code: string): string {
  // Special cases that Verbum AI uses specific codes for
  const specialCases: Record<string, string> = {
    'zh-CN': 'zh-Hans',  // Chinese Simplified
    'zh-TW': 'zh-Hant',  // Chinese Traditional
    'zh-HK': 'zh-Hant',  // Chinese Hong Kong -> Traditional
    'pt-PT': 'pt-pt',    // Portuguese Portugal
    'fr-CA': 'fr-ca',    // French Canada
    'mn-MN': 'mn-Cyrl',  // Mongolian Cyrillic
    'sr-RS': 'sr-Cyrl',  // Serbian Cyrillic
    'iu-CA': 'iu',       // Inuktitut
  };

  // Check if there's a special case mapping
  if (specialCases[code]) {
    return specialCases[code];
  }

  // For most languages, just take the first 2 letters (en-US -> en, es-CR -> es)
  const baseCode = code.split('-')[0].toLowerCase();
  return baseCode;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseAdmin;
    const body = (await request.json()) as TranslateEmailRequestBody;
    const { messageId, targetLanguages } = body;

    // Validate request
    if (!messageId || !targetLanguages || targetLanguages.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: messageId and targetLanguages are required" },
        { status: 400 }
      );
    }

    // Note: Using admin client, so no auth check needed
    // In production, you would validate the user's session token

    // Fetch the message
    const { data: message, error: fetchError } = await supabase
      .from('email_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchError || !message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    // Check if API key is configured
    const apiKey = process.env.VERBUM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Translation service not configured" },
        { status: 500 }
      );
    }

    // Filter out languages that already have translations
    const existingTranslations = message.translations || {};
    const languagesToTranslate = targetLanguages.filter(
      lang => !existingTranslations[lang] && lang !== message.original_language
    );

    if (languagesToTranslate.length === 0) {
      // All requested translations already exist
      return NextResponse.json({
        success: true,
        translations: existingTranslations,
        message: "All translations already exist"
      });
    }

    // Map language codes to Verbum AI format
    const mappedFrom = mapToVerbumLanguageCode(message.original_language);
    const mappedTo = languagesToTranslate.map(mapToVerbumLanguageCode);

    console.log('[Email Translation] Translating:', {
      messageId,
      from: message.original_language,
      to: languagesToTranslate,
      mapped: { from: mappedFrom, to: mappedTo }
    });

    // Call Verbum API
    const response = await fetch("https://sdk.verbum.ai/v1/translator/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        texts: [{ text: message.original_content }],
        from: mappedFrom,
        to: mappedTo,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Verbum API error:", response.status, errorText);
      return NextResponse.json(
        {
          error: "Translation service error",
          details: errorText,
        },
        { status: response.status }
      );
    }

    const translationData = await response.json();
    console.log('[Email Translation] Verbum response:', translationData);

    // Parse Verbum response and update message translations
    const newTranslations = { ...existingTranslations };
    
    // Verbum returns: { translations: [{ text: "...", to: "en" }, ...] }
    if (translationData.translations && Array.isArray(translationData.translations)) {
      translationData.translations.forEach((translation: any) => {
        const targetLang = translation.to;
        const translatedText = translation.text;
        
        // Map back from Verbum code to our code if needed
        // For now, we'll use the Verbum code directly
        newTranslations[targetLang] = translatedText;
      });
    }

    // Update message in database
    const { error: updateError } = await supabase
      .from('email_messages')
      .update({ translations: newTranslations })
      .eq('id', messageId);

    if (updateError) {
      console.error('Error updating message translations:', updateError);
      return NextResponse.json(
        { error: "Failed to save translations" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      translations: newTranslations,
    });

  } catch (error) {
    console.error("Email translation error:", error);
    return NextResponse.json(
      {
        error: "Failed to translate email",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
