import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Webhook endpoint for receiving inbound emails from Resend
 * 
 * Resend will POST to this endpoint when an email is received
 * Configure in Resend Dashboard: Webhooks → Add Webhook → email.received
 * 
 * Webhook URL: https://yourdomain.com/api/email/inbound
 */

interface ResendInboundEmail {
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  reply_to?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ResendInboundEmail = await request.json();
    
    console.log('Received inbound email:', {
      from: body.from,
      to: body.to,
      subject: body.subject,
    });

    // Extract sender info
    const senderEmail = extractEmail(body.from);
    const senderName = extractName(body.from) || senderEmail.split('@')[0];
    
    // Extract content (prefer text over HTML)
    const content = body.text || stripHTML(body.html || '');
    
    if (!content || !senderEmail) {
      return NextResponse.json(
        { error: 'Invalid email content or sender' },
        { status: 400 }
      );
    }

    // Detect language of the incoming email
    const detectedLanguage = await detectLanguage(content);
    
    // Find or create thread
    // Look for existing thread with this sender
    const { data: existingThreads } = await supabaseAdmin
      .from('email_threads')
      .select('*')
      .contains('participants', [{ email: senderEmail }])
      .order('last_message_at', { ascending: false })
      .limit(1);

    let threadId: string;
    let thread;

    if (existingThreads && existingThreads.length > 0) {
      // Use existing thread
      thread = existingThreads[0];
      threadId = thread.id;
      
      // Update last_message_at
      await supabaseAdmin
        .from('email_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', threadId);
    } else {
      // Create new thread
      const { data: newThread, error: threadError } = await supabaseAdmin
        .from('email_threads')
        .insert({
          subject: body.subject || '(No Subject)',
          participants: [
            {
              email: senderEmail,
              name: senderName,
              language: detectedLanguage,
            },
            {
              email: body.to[0], // The recipient (your email)
              name: body.to[0].split('@')[0],
              language: 'en', // Default to English for your account
            },
          ],
          last_message_at: new Date().toISOString(),
          is_demo: false,
        })
        .select()
        .single();

      if (threadError) {
        console.error('Error creating thread:', threadError);
        return NextResponse.json(
          { error: 'Failed to create thread' },
          { status: 500 }
        );
      }

      thread = newThread;
      threadId = newThread.id;
    }

    // Translate the content to English (or other target languages)
    const translations: Record<string, string> = {};
    
    if (detectedLanguage !== 'en') {
      try {
        const translateResponse = await fetch(
          `${process.env.NEXT_PUBLIC_VERBUM_API_URL || 'https://api.verbum.ai'}/translate`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.VERBUM_API_KEY}`,
            },
            body: JSON.stringify({
              text: content,
              source_language: detectedLanguage,
              target_language: 'en',
            }),
          }
        );

        if (translateResponse.ok) {
          const translateData = await translateResponse.json();
          translations.en = translateData.translated_text || content;
        }
      } catch (err) {
        console.error('Translation failed:', err);
        translations.en = content; // Fallback to original
      }
    }

    // Store the message in database
    const { data: message, error: messageError } = await supabaseAdmin
      .from('email_messages')
      .insert({
        thread_id: threadId,
        sender_email: senderEmail,
        sender_name: senderName,
        sender_language: detectedLanguage,
        original_content: content,
        original_language: detectedLanguage,
        translations,
        is_outbound: false,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message:', messageError);
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      );
    }

    // Contact will be auto-created by the database trigger

    return NextResponse.json({
      success: true,
      message: 'Email received and processed',
      threadId,
      messageId: message.id,
    });
  } catch (error) {
    console.error('Error processing inbound email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Extract email address from "Name <email@domain.com>" format
 */
function extractEmail(from: string): string {
  const match = from.match(/<(.+?)>/);
  return match ? match[1] : from;
}

/**
 * Extract name from "Name <email@domain.com>" format
 */
function extractName(from: string): string | null {
  const match = from.match(/^(.+?)\s*</);
  return match ? match[1].trim() : null;
}

/**
 * Strip HTML tags and get plain text
 */
function stripHTML(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect language of text
 * For now, we'll use a simple heuristic or call Verbum API
 */
async function detectLanguage(text: string): Promise<string> {
  // Simple heuristic: check for common words
  const spanishWords = /\b(hola|gracias|por favor|buenos días)\b/i;
  const frenchWords = /\b(bonjour|merci|s'il vous plaît)\b/i;
  const japaneseChars = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  
  if (spanishWords.test(text)) return 'es';
  if (frenchWords.test(text)) return 'fr';
  if (japaneseChars.test(text)) return 'ja';
  
  // Default to English
  return 'en';
}

// Also support GET for webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Inbound email webhook endpoint',
  });
}
