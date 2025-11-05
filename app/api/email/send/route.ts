import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface SendEmailRequestBody {
  threadId: string;
  content: string;
  senderLanguage: string;
  recipientLanguage: string;
}

/**
 * Map our detailed language codes to Verbum AI's format
 */
function mapToVerbumLanguageCode(code: string): string {
  const specialCases: Record<string, string> = {
    'zh-CN': 'zh-Hans',
    'zh-TW': 'zh-Hant',
    'zh-HK': 'zh-Hant',
    'pt-PT': 'pt-pt',
    'fr-CA': 'fr-ca',
    'mn-MN': 'mn-Cyrl',
    'sr-RS': 'sr-Cyrl',
    'iu-CA': 'iu',
  };

  if (specialCases[code]) {
    return specialCases[code];
  }

  const baseCode = code.split('-')[0].toLowerCase();
  return baseCode;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = (await request.json()) as SendEmailRequestBody;
    const { threadId, content, senderLanguage, recipientLanguage } = body;

    // Validate request
    if (!threadId || !content || !senderLanguage || !recipientLanguage) {
      return NextResponse.json(
        { error: "Invalid request: all fields are required" },
        { status: 400 }
      );
    }

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user info
    const senderEmail = user.email || 'unknown@example.com';
    const senderName = user.user_metadata?.name || user.email?.split('@')[0] || 'User';

    // Create the message first
    const newMessage = {
      thread_id: threadId,
      sender_email: senderEmail,
      sender_name: senderName,
      sender_language: senderLanguage,
      original_content: content,
      original_language: senderLanguage,
      translations: {},
      is_outbound: true,
      metadata: {},
    };

    const { data: message, error: insertError } = await supabase
      .from('email_messages')
      .insert(newMessage)
      .select()
      .single();

    if (insertError || !message) {
      console.error('Error creating message:', insertError);
      return NextResponse.json(
        { error: "Failed to create message" },
        { status: 500 }
      );
    }

    // Update thread's last_message_at
    await supabase
      .from('email_threads')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', threadId);

    // If sender and recipient languages are different, translate the message
    if (senderLanguage !== recipientLanguage) {
      const apiKey = process.env.VERBUM_API_KEY;
      
      if (apiKey) {
        try {
          const mappedFrom = mapToVerbumLanguageCode(senderLanguage);
          const mappedTo = [mapToVerbumLanguageCode(recipientLanguage)];

          console.log('[Email Send] Translating message:', {
            from: senderLanguage,
            to: recipientLanguage,
            mapped: { from: mappedFrom, to: mappedTo }
          });

          const response = await fetch("https://sdk.verbum.ai/v1/translator/translate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
            },
            body: JSON.stringify({
              texts: [{ text: content }],
              from: mappedFrom,
              to: mappedTo,
            }),
          });

          if (response.ok) {
            const translationData = await response.json();
            console.log('[Email Send] Translation response:', translationData);

            // Update message with translation
            const translations: Record<string, string> = {};
            
            if (translationData.translations && Array.isArray(translationData.translations)) {
              translationData.translations.forEach((translation: any) => {
                translations[translation.to] = translation.text;
              });
            }

            await supabase
              .from('email_messages')
              .update({ translations })
              .eq('id', message.id);

            return NextResponse.json({
              success: true,
              message: {
                ...message,
                translations,
              },
            });
          } else {
            console.error('Translation failed:', response.status);
            // Return message without translation
            return NextResponse.json({
              success: true,
              message,
              warning: "Message sent but translation failed",
            });
          }
        } catch (translationError) {
          console.error('Translation error:', translationError);
          // Return message without translation
          return NextResponse.json({
            success: true,
            message,
            warning: "Message sent but translation failed",
          });
        }
      }
    }

    // No translation needed or API key not configured
    return NextResponse.json({
      success: true,
      message,
    });

  } catch (error) {
    console.error("Send email error:", error);
    return NextResponse.json(
      {
        error: "Failed to send email",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
