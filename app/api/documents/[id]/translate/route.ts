import { NextRequest, NextResponse } from 'next/server';
import { getDocumentTranslation, updateDocumentProgress, completeDocumentTranslation, failDocumentTranslation, storeTranslatedChunks } from '@/lib/db/documents';
import { uploadDocumentToS3 } from '@/lib/s3';
import { reconstructDocument, createTranslatedDocumentBuffer } from '@/lib/documentProcessor';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/documents/[id]/translate
 * Trigger translation for a document
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversationId = parseInt(id);
    
    if (isNaN(conversationId)) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }
    
    // Get document translation record
    const document = await getDocumentTranslation(conversationId);
    
    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }
    
    // Get all chunks from conversation_messages
    const supabase = await createClient();
    const { data: messages, error: messagesError } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversationId', conversationId)
      .order('id', { ascending: true });
    
    if (messagesError || !messages || messages.length === 0) {
      throw new Error('No text chunks found for translation');
    }
    
    console.log(`[Document Translate] Translating ${messages.length} chunks`);
    
    // Translate each chunk
    const translatedChunks: string[] = [];
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const progress = Math.round(((i + 1) / messages.length) * 100);
      
      console.log(`[Document Translate] Translating chunk ${i + 1}/${messages.length}`);
      
      // Update progress
      await updateDocumentProgress({
        conversationId,
        progressPercentage: progress,
      });
      
      // Call translation API
      const translationResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: [{ text: message.original_text }],
          from: document.language1,
          to: [document.language2],
        }),
      });
      
      if (!translationResponse.ok) {
        throw new Error(`Translation API failed for chunk ${i + 1}`);
      }
      
      const translationData = await translationResponse.json();
      
      // Extract translated text
      const translatedText = translationData.translations?.[0]?.[document.language2]?.text;
      
      if (!translatedText) {
        throw new Error(`No translation returned for chunk ${i + 1}`);
      }
      
      translatedChunks.push(translatedText);
    }
    
    console.log('[Document Translate] All chunks translated successfully');
    
    // Store translated chunks in database
    await storeTranslatedChunks({
      conversationId,
      translatedChunks,
      targetLanguage: document.language2,
    });
    
    // Reconstruct full document
    const translatedText = reconstructDocument(translatedChunks);
    
    // Create translated document buffer
    const { buffer, mimeType, extension } = createTranslatedDocumentBuffer(
      translatedText,
      document.metadata?.document_translation?.file_type || 'text/plain'
    );
    
    // Upload translated document to S3
    const originalFilename = document.metadata?.document_translation?.original_filename || 'document';
    const translatedFilename = originalFilename.replace(/\.[^.]+$/, '') + '_translated' + extension;
    
    const translatedS3Url = await uploadDocumentToS3({
      fileBuffer: buffer,
      fileName: translatedFilename,
      contentType: mimeType,
      enterpriseId: document.enterprise_id!,
      userId: document.userId,
      conversationId,
      isTranslated: true,
    });
    
    console.log('[Document Translate] Uploaded translated document to S3:', translatedS3Url);
    
    // Mark translation as completed
    await completeDocumentTranslation({
      conversationId,
      translatedFileUrl: translatedS3Url,
    });
    
    console.log('[Document Translate] Translation completed successfully');
    
    // Send completion email notification
    try {
      const { sendDocumentCompletionEmail } = await import('@/lib/resend');
      const { getDocumentDownloadUrl } = await import('@/lib/s3');
      
      // Get user email
      const { data: user } = await supabase
        .from('users')
        .select('email, name')
        .eq('id', document.userId)
        .single();
      
      if (user?.email) {
        // Generate download URL
        const downloadUrl = await getDocumentDownloadUrl(translatedS3Url, 86400);
        
        await sendDocumentCompletionEmail({
          to: user.email,
          toName: user.name || undefined,
          documentName: originalFilename,
          downloadUrl,
          sourceLanguage: document.language1,
          targetLanguage: document.language2,
        });
        
        console.log('[Document Translate] Completion email sent to:', user.email);
      }
    } catch (emailError) {
      console.error('[Document Translate] Failed to send completion email:', emailError);
      // Don't fail the whole request if email fails
    }
    
    return NextResponse.json({
      success: true,
      message: 'Document translated successfully',
      conversationId,
      translatedFileUrl: translatedS3Url,
    });
    
  } catch (error) {
    console.error('[Document Translate] Error:', error);
    
    // Mark translation as failed
    try {
      const { id } = await params;
      await failDocumentTranslation({
        conversationId: parseInt(id),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (updateError) {
      console.error('[Document Translate] Failed to update error status:', updateError);
    }
    
    return NextResponse.json(
      {
        error: 'Failed to translate document',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
