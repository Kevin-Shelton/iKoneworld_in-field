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

    // Translate content and subject to each recipient's language
    const translations: Record<string, string> = {};
    const subjectTranslations: Record<string, string> = {};
    
    for (const recipient of recipients as Recipient[]) {
      if (recipient.language === senderLanguage) {
        // No translation needed
        translations[recipient.language] = content;
        subjectTranslations[recipient.language] = subject || '(No Subject)';
      } else {
        // Call translation API for both content and subject
        try {
          const textsToTranslate = [{ text: content }];
          if (subject) {
            textsToTranslate.push({ text: subject });
          }

          const translateResponse = await fetch(
            'https://sdk.verbum.ai/v1/translator/translate',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.VERBUM_API_KEY!,
              },
              body: JSON.stringify({
                texts: textsToTranslate,
                from: senderLanguage,
                to: [recipient.language],
              }),
            }
          );

          if (translateResponse.ok) {
            const translateData = await translateResponse.json();
            console.log(`[Send Multi] Translation to ${recipient.language}:`, translateData);
            translations[recipient.language] = translateData.translations?.[0]?.[0]?.text || content;
            subjectTranslations[recipient.language] = translateData.translations?.[0]?.[1]?.text || subject || '(No Subject)';
          } else {
            const errorText = await translateResponse.text();
            console.error(`[Send Multi] Translation API error for ${recipient.language}:`, translateResponse.status, errorText);
            // Fallback to original if translation fails
            translations[recipient.language] = content;
            subjectTranslations[recipient.language] = subject || '(No Subject)';
          }
        } catch (err) {
          console.error(`Translation failed for ${recipient.language}:`, err);
          translations[recipient.language] = content;
          subjectTranslations[recipient.language] = subject || '(No Subject)';
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
          is_demo: true,
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
	    
	    // Log the number of recipients we are about to process
	    console.log(`[Send Multi] Processing ${recipients.length} recipients...`);
	    
	    for (const recipient of recipients as Recipient[]) {
      try {
        // Send the translated email
        const result = await sendTranslatedEmail({
          to: recipient.email,
          toName: recipient.name,
          subject: subjectTranslations[recipient.language] || subject || '(No Subject)',
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

	    console.log('[Send Multi] Final email results:', emailResults);
	    
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
