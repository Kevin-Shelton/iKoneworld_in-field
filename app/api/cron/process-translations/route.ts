import { NextRequest, NextResponse } from 'next/server';
import {
  getNextPendingChunk,
  updateChunkTranslation,
  markChunkAsFailed,
  getConversationProgress,
  isConversationComplete,
  getConversationChunks,
  getPendingChunkCount,
} from '@/lib/db/translationQueue';
import { updateDocumentProgress, completeDocumentTranslation } from '@/lib/db/documents';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Vercel Cron Job: Process Translation Queue
 * 
 * This endpoint is called every minute by Vercel Cron to process pending translation chunks.
 * It processes one chunk at a time to avoid serverless timeouts.
 * 
 * Configuration in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/process-translations",
 *     "schedule": "* * * * *"
 *   }]
 * }
 */

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify cron secret (security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[Cron] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[Cron] Starting translation queue processing...');
    
    // Get pending chunk count
    const pendingCount = await getPendingChunkCount();
    console.log(`[Cron] Pending chunks: ${pendingCount}`);
    
    if (pendingCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending chunks',
        processed: 0,
        duration: Date.now() - startTime,
      });
    }
    
    // Get next chunk to process
    const chunk = await getNextPendingChunk();
    
    if (!chunk) {
      return NextResponse.json({
        success: true,
        message: 'No chunk available',
        processed: 0,
        duration: Date.now() - startTime,
      });
    }
    
    console.log(`[Cron] Processing chunk ${chunk.id} for conversation ${chunk.conversationId}`);
    console.log(`[Cron] Chunk ${chunk.metadata?.chunk_index + 1}/${chunk.metadata?.chunk_total}`);
    
    // Get conversation details for language info
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('language1, language2')
      .eq('id', chunk.conversationId)
      .single();
    
    if (!conversation) {
      console.error('[Cron] Conversation not found:', chunk.conversationId);
      await markChunkAsFailed({
        chunkId: chunk.id,
        errorMessage: 'Conversation not found',
      });
      
      return NextResponse.json({
        success: false,
        error: 'Conversation not found',
        duration: Date.now() - startTime,
      });
    }
    
    try {
      // Call Verbum AI API directly (not through localhost)
      const verbumApiKey = process.env.VERBUM_API_KEY;
      
      if (!verbumApiKey) {
        throw new Error('VERBUM_API_KEY not configured');
      }
      
      const translationResponse = await fetch(
        'https://sdk.verbum.ai/v1/translator/translate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': verbumApiKey,
          },
          body: JSON.stringify({
            texts: [{ text: chunk.original_text }],  // texts (plural) as per Verbum API
            from: conversation.language1,
            to: [conversation.language2],
          }),
        }
      );
      
      if (!translationResponse.ok) {
        const errorText = await translationResponse.text();
        throw new Error(`Verbum API failed: ${translationResponse.status} - ${errorText}`);
      }
      
      const translationData = await translationResponse.json();
      
      // Extract translated text from Verbum API response
      // Verbum returns: translations[0][0].text (nested array)
      const translatedText = translationData.translations?.[0]?.[0]?.text;
      
      if (!translatedText) {
        throw new Error('No translation returned from Verbum API');
      }
      
      // Update chunk with translation
      await updateChunkTranslation({
        chunkId: chunk.id,
        translatedText,
        targetLanguage: conversation.language2,
        confidence: 95,
      });
      
      console.log(`[Cron] Successfully translated chunk ${chunk.id}`);
      
      // Update conversation progress
      const progress = await getConversationProgress(chunk.conversationId);
      await updateDocumentProgress({
        conversationId: chunk.conversationId,
        progressPercentage: progress.percentage,
      });
      
      console.log(`[Cron] Conversation ${chunk.conversationId} progress: ${progress.percentage}%`);
      
      // Check if conversation is complete
      if (await isConversationComplete(chunk.conversationId)) {
        console.log(`[Cron] Conversation ${chunk.conversationId} is complete! Reconstructing document...`);
        
        // Get all chunks
        const chunks = await getConversationChunks(chunk.conversationId);
        const translatedTexts = chunks.map(c => c.translated_text);  // snake_case from database
        
        // Get conversation metadata for file info
        const { data: conv } = await supabaseAdmin
          .from('conversations')
          .select('metadata, audio_url, userId, enterprise_id')
          .eq('id', chunk.conversationId)
          .single();
        
        if (conv) {
          const originalFilename = conv.metadata?.document_translation?.original_filename || 'document.docx';
          const fileType = conv.metadata?.document_translation?.file_type || 'text/plain';
          const isHtmlContent = conv.metadata?.document_translation?.is_html_content || false;
          
          console.log(`[Cron] Reconstructing document (HTML: ${isHtmlContent})`);
          
          // Reconstruct document based on content type
          let fullTranslatedContent: string;
          
          if (isHtmlContent) {
            const { reconstructHtmlDocument } = await import('@/lib/documentProcessor');
            fullTranslatedContent = reconstructHtmlDocument(translatedTexts);
            console.log('[Cron] Reconstructed HTML document with formatting');
          } else {
            fullTranslatedContent = translatedTexts.join('\n\n');
            console.log('[Cron] Reconstructed plain text document');
          }
          
          // Download original file if PDF (needed for format preservation)
          let originalFileBuffer: Buffer | undefined;
          
          if (fileType === 'application/pdf') {
            console.log('[Cron] Downloading original PDF for format preservation');
            // Original file is stored in audio_url field
            const originalStoragePath = conv.audio_url || conv.metadata?.document_translation?.original_storage_path;
            
            if (originalStoragePath) {
              const { data: fileData, error: downloadError } = await supabaseAdmin
                .storage
                .from('documents')
                .download(originalStoragePath);
              
              if (downloadError) {
                console.error('[Cron] Failed to download original PDF:', downloadError);
              } else if (fileData) {
                originalFileBuffer = Buffer.from(await fileData.arrayBuffer());
                console.log('[Cron] Original PDF downloaded successfully');
              }
            }
          }
          
          // Create translated document buffer
          const { createTranslatedDocumentBuffer } = await import('@/lib/documentProcessor');
          const { buffer, mimeType, extension } = await createTranslatedDocumentBuffer(
            fullTranslatedContent,
            fileType,
            isHtmlContent,
            originalFileBuffer
          );
          
          console.log(`[Cron] Created document buffer: ${buffer.length} bytes, type: ${mimeType}`);
          
          // Upload to Supabase Storage
          const { uploadDocumentToSupabase } = await import('@/lib/supabaseStorage');
          const translatedFilename = originalFilename.replace(/\.[^.]+$/, '') + '_translated' + extension;
          
          const translatedStoragePath = await uploadDocumentToSupabase({
            fileBuffer: buffer,
            fileName: translatedFilename,
            contentType: mimeType,
            enterpriseId: conv.enterprise_id || 'default',
            userId: conv.userId,
            conversationId: chunk.conversationId,
            isTranslated: true,
          });
          
          console.log(`[Cron] Uploaded translated document: ${translatedStoragePath}`);
          
          // Mark as completed
          await completeDocumentTranslation({
            conversationId: chunk.conversationId,
            translatedFileUrl: translatedStoragePath,
          });
          
          console.log(`[Cron] Document translation completed for conversation ${chunk.conversationId}`);
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Chunk processed successfully',
        processed: 1,
        chunkId: chunk.id,
        conversationId: chunk.conversationId,
        progress: progress.percentage,
        pendingRemaining: pendingCount - 1,
        duration: Date.now() - startTime,
      });
      
    } catch (translationError) {
      console.error('[Cron] Translation error:', translationError);
      
      // Mark chunk as failed
      await markChunkAsFailed({
        chunkId: chunk.id,
        errorMessage: translationError instanceof Error ? translationError.message : 'Translation failed',
      });
      
      // Update conversation status to failed if too many retries
      const retryCount = chunk.metadata?.retry_count || 0;
      if (retryCount >= 3) {
        await supabaseAdmin
          .from('conversations')
          .update({
            status: 'failed',
            metadata: {
              ...conversation,
              document_translation: {
                error_message: 'Translation failed after multiple retries',
              },
            },
          })
          .eq('id', chunk.conversationId);
      }
      
      return NextResponse.json({
        success: false,
        error: translationError instanceof Error ? translationError.message : 'Translation failed',
        chunkId: chunk.id,
        conversationId: chunk.conversationId,
        duration: Date.now() - startTime,
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('[Cron] Fatal error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}

// Allow POST as well (for manual triggering)
export async function POST(request: NextRequest) {
  return GET(request);
}
