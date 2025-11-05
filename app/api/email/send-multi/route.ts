import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendTranslatedEmail } from '@/lib/resend';

interface Recipient {
  email: string;
  name?: string;
  language: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      threadId,
      subject,
      content,
      recipients,
      senderEmail,
      senderLanguage,
      mode,
    } = body;

    if (!content || !recipients || recipients.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Translate content to each recipient's language
    const translations: Record<string, string> = {};
    
    for (const recipient of recipients as Recipient[]) {
      if (recipient.language === senderLanguage) {
        // No translation needed
        translations[recipient.language] = content;
      } else {
        // Call translation API
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
                source_language: senderLanguage,
                target_language: recipient.language,
              }),
            }
          );

          if (translateResponse.ok) {
            const translateData = await translateResponse.json();
            translations[recipient.language] = translateData.translated_text || content;
          } else {
            // Fallback to original if translation fails
            translations[recipient.language] = content;
          }
        } catch (err) {
          console.error(`Translation failed for ${recipient.language}:`, err);
          translations[recipient.language] = content;
        }
      }
    }

    // Determine if we need to create a new thread or use existing
    let finalThreadId = threadId;

    if (!threadId || mode === 'compose') {
      // Create new thread
      const participants = [
        {
          email: senderEmail,
          name: senderEmail.split('@')[0],
          language: senderLanguage,
        },
        ...recipients.map((r: Recipient) => ({
          email: r.email,
          name: r.name || r.email.split('@')[0],
          language: r.language,
        })),
      ];

      const { data: newThread, error: threadError } = await supabaseAdmin
        .from('email_threads')
        .insert({
          subject: subject || '(No Subject)',
          participants,
          last_message_at: new Date().toISOString(),
          is_demo: false,
        })
        .select()
        .single();

      if (threadError) {
        console.error('Error creating thread:', threadError);
        return NextResponse.json(
          { error: 'Failed to create email thread' },
          { status: 500 }
        );
      }

      finalThreadId = newThread.id;
    }

    // Update thread's last_message_at
    await supabaseAdmin
      .from('email_threads')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', finalThreadId);

    // Create message in database
    const { data: message, error: messageError } = await supabaseAdmin
      .from('email_messages')
      .insert({
        thread_id: finalThreadId,
        sender_email: senderEmail,
        sender_name: senderEmail.split('@')[0],
        sender_language: senderLanguage,
        original_content: content,
        original_language: senderLanguage,
        translations,
        is_outbound: true,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message:', messageError);
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      );
    }

    // Send actual emails via Resend and update contacts
    const emailResults = [];
    for (const recipient of recipients as Recipient[]) {
      try {
        // Send the translated email
        const result = await sendTranslatedEmail({
          to: recipient.email,
          toName: recipient.name,
          subject: subject || '(No Subject)',
          content: translations[recipient.language],
          senderEmail,
          senderName: senderEmail.split('@')[0],
        });
        
        emailResults.push({
          recipient: recipient.email,
          success: true,
          messageId: result.messageId,
        });
      } catch (err) {
        console.error(`Failed to send email to ${recipient.email}:`, err);
        emailResults.push({
          recipient: recipient.email,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      // Update or create contact
      await supabaseAdmin
        .from('contacts')
        .upsert(
          {
            email: recipient.email,
            name: recipient.name || recipient.email.split('@')[0],
            language: recipient.language,
            last_contacted_at: new Date().toISOString(),
          },
          {
            onConflict: 'email',
          }
        );
    }

    return NextResponse.json({
      success: true,
      message,
      threadId: finalThreadId,
      recipientCount: recipients.length,
      emailResults,
    });
  } catch (error) {
    console.error('Error in send-multi API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
