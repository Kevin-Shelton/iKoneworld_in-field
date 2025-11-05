import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { Resend } from 'resend';

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

interface ResendWebhookPayload {
  created_at: string;
  data: ResendInboundEmail;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    // Log the full payload to debug
    console.log('Full webhook payload:', JSON.stringify(payload, null, 2));
    
    // Resend sends the email data nested in a 'data' object
    const webhookData = payload.data || payload;
    
    console.log('Received inbound email:', {
      from: webhookData.from,
      to: webhookData.to,
      subject: webhookData.subject,
      email_id: webhookData.email_id,
    });
    
    // Validate email_id exists
    if (!webhookData.email_id) {
      console.error('Missing email_id in webhook data:', webhookData);
      return NextResponse.json(
        { error: 'Missing email_id in webhook payload' },
        { status: 400 }
      );
    }
    
    // Fetch the full email content from Resend API
    // Webhooks don't include the body, we need to fetch it separately
    console.log('Fetching email content for ID:', webhookData.email_id);
    
    // Use direct REST API call instead of SDK to avoid parameter issues
    const emailResponse = await fetch(
      `https://api.resend.com/emails/receiving/${webhookData.email_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Error fetching email content:', {
        status: emailResponse.status,
        statusText: emailResponse.statusText,
        body: errorText,
      });
      return NextResponse.json(
        { error: 'Failed to fetch email content from Resend API' },
        { status: 500 }
      );
    }
    
    const emailData = await emailResponse.json();
    
    console.log('Fetched email content:', {
      hasText: !!emailData.text,
      hasHtml: !!emailData.html,
      textLength: emailData.text?.length || 0,
    });
    
    // Merge webhook data with fetched email content
    const body: ResendInboundEmail = {
      from: webhookData.from,
      to: webhookData.to,
      subject: webhookData.subject,
      text: emailData.text,
      html: emailData.html,
      headers: emailData.headers,
      reply_to: webhookData.reply_to,
    };

    // Extract sender info
    const senderEmail = extractEmail(body.from);
    const senderName = extractName(body.from) || senderEmail.split('@')[0];
    
    // Extract content (prefer text over HTML)
    const content = body.text || stripHTML(body.html || '') || '(No content)';
    
    if (!senderEmail) {
      return NextResponse.json(
        { error: 'Invalid sender email' },
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
