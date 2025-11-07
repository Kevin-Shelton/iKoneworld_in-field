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
      // Call translation API
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const translationResponse = await fetch(`${baseUrl}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: [{ text: chunk.originalText }],
          from: conversation.language1,
          to: [conversation.language2],
        }),
      });
      
      if (!translationResponse.ok) {
        const errorText = await translationResponse.text();
        throw new Error(`Translation API failed: ${translationResponse.status} - ${errorText}`);
      }
      
      const translationData = await translationResponse.json();
      
      // Extract translated text
      const translatedText = translationData.translations?.[0]?.texts?.[0]?.text;
      
      if (!translatedText) {
        throw new Error('No translation returned from API');
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
        const translatedTexts = chunks.map(c => c.translatedText);
        const fullTranslatedText = translatedTexts.join('\n\n');
        
        // Get conversation metadata for file info
        const { data: conv } = await supabaseAdmin
          .from('conversations')
          .select('metadata, audio_url')
          .eq('id', chunk.conversationId)
          .single();
        
        if (conv) {
          const originalFilename = conv.metadata?.document_translation?.original_filename || 'document.docx';
          const fileType = conv.metadata?.document_translation?.file_type || 'docx';
          
          // Reconstruct document (this will be implemented based on file type)
          // For now, we'll mark as completed and store the translated text
          await completeDocumentTranslation({
            conversationId: chunk.conversationId,
            translatedFileUrl: '', // Will be implemented with document reconstruction
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
