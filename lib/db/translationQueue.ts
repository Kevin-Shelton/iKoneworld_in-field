import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Translation Queue Management
 * 
 * This module handles async translation processing using a database-backed queue.
 * Chunks are processed one at a time by a cron job to avoid serverless timeouts.
 */

export interface QueuedChunk {
  id: number;
  conversationId: number;
  original_text: string;  // snake_case to match database
  translated_text: string;  // snake_case to match database
  language: string;
  confidence: number;
  metadata: {
    chunk_index: number;
    chunk_total: number;
    translation_status?: 'pending' | 'processing' | 'completed' | 'failed';
    retry_count?: number;
    last_error?: string;
  };
}

/**
 * Get next pending chunk to translate
 */
export async function getNextPendingChunk(): Promise<QueuedChunk | null> {
  const supabase = supabaseAdmin;
  
  try {
    // Find oldest pending chunk
    const { data: messages, error } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('translated_text', '') // Empty means not translated yet - snake_case
      .order('id', { ascending: true })
      .limit(1);
    
    if (error) {
      console.error('[Queue] Error fetching pending chunk:', error);
      return null;
    }
    
    if (!messages || messages.length === 0) {
      return null;
    }
    
    return messages[0] as QueuedChunk;
  } catch (error) {
    console.error('[Queue] Error in getNextPendingChunk:', error);
    return null;
  }
}

/**
 * Mark chunk as processing (to prevent duplicate processing)
 */
export async function markChunkAsProcessing(chunkId: number): Promise<boolean> {
  const supabase = supabaseAdmin;
  
  try {
    const { error } = await supabase
      .from('conversation_messages')
      .update({
        metadata: {
          translation_status: 'processing',
        },
      })
      .eq('id', chunkId);
    
    if (error) {
      console.error('[Queue] Error marking chunk as processing:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[Queue] Error in markChunkAsProcessing:', error);
    return false;
  }
}

/**
 * Update chunk with translation result
 */
export async function updateChunkTranslation({
  chunkId,
  translatedText,
  targetLanguage,
  confidence = 95,
}: {
  chunkId: number;
  translatedText: string;
  targetLanguage: string;
  confidence?: number;
}): Promise<boolean> {
  const supabase = supabaseAdmin;
  
  try {
    // Get current metadata
    const { data: message } = await supabase
      .from('conversation_messages')
      .select('metadata')
      .eq('id', chunkId)
      .single();
    
    const { error } = await supabase
      .from('conversation_messages')
      .update({
        translated_text: translatedText, // snake_case column name
        language: targetLanguage,
        confidence,
        metadata: {
          ...message?.metadata,
          translation_status: 'completed',
        },
      })
      .eq('id', chunkId);
    
    if (error) {
      console.error('[Queue] Error updating chunk translation:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[Queue] Error in updateChunkTranslation:', error);
    return false;
  }
}

/**
 * Mark chunk as failed
 */
export async function markChunkAsFailed({
  chunkId,
  errorMessage,
}: {
  chunkId: number;
  errorMessage: string;
}): Promise<boolean> {
  const supabase = supabaseAdmin;
  
  try {
    // Get current metadata
    const { data: message } = await supabase
      .from('conversation_messages')
      .select('metadata')
      .eq('id', chunkId)
      .single();
    
    const currentRetryCount = message?.metadata?.retry_count || 0;
    
    const { error } = await supabase
      .from('conversation_messages')
      .update({
        metadata: {
          ...message?.metadata,
          translation_status: 'failed',
          retry_count: currentRetryCount + 1,
          last_error: errorMessage,
        },
      })
      .eq('id', chunkId);
    
    if (error) {
      console.error('[Queue] Error marking chunk as failed:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[Queue] Error in markChunkAsFailed:', error);
    return false;
  }
}

/**
 * Get translation progress for a conversation
 */
export async function getConversationProgress(conversationId: number): Promise<{
  total: number;
  completed: number;
  failed: number;
  pending: number;
  percentage: number;
}> {
  const supabase = supabaseAdmin;
  
  try {
    const { data: messages, error } = await supabase
      .from('conversation_messages')
      .select('translated_text, metadata') // snake_case column names
      .eq('conversationId', conversationId);
    
    if (error || !messages) {
      return { total: 0, completed: 0, failed: 0, pending: 0, percentage: 0 };
    }
    
    const total = messages.length;
    const completed = messages.filter((m: any) => m.translated_text && m.translated_text !== '').length;
    const failed = messages.filter((m: any) => m.metadata?.translation_status === 'failed').length;
    const pending = total - completed - failed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, failed, pending, percentage };
  } catch (error) {
    console.error('[Queue] Error in getConversationProgress:', error);
    return { total: 0, completed: 0, failed: 0, pending: 0, percentage: 0 };
  }
}

/**
 * Check if all chunks for a conversation are completed
 */
export async function isConversationComplete(conversationId: number): Promise<boolean> {
  const progress = await getConversationProgress(conversationId);
  return progress.pending === 0 && progress.failed === 0 && progress.total > 0;
}

/**
 * Get all chunks for a conversation (for document reconstruction)
 */
export async function getConversationChunks(conversationId: number): Promise<QueuedChunk[]> {
  const supabase = supabaseAdmin;
  
  try {
    const { data: messages, error } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversationId', conversationId)
      .order('id', { ascending: true });
    
    if (error || !messages) {
      return [];
    }
    
    return messages as QueuedChunk[];
  } catch (error) {
    console.error('[Queue] Error in getConversationChunks:', error);
    return [];
  }
}

/**
 * Get count of pending chunks across all conversations
 */
export async function getPendingChunkCount(): Promise<number> {
  const supabase = supabaseAdmin;
  
  try {
    const { count, error } = await supabase
      .from('conversation_messages')
      .select('*', { count: 'exact', head: true })
      .eq('translated_text', ''); // snake_case column name
    
    if (error) {
      console.error('[Queue] Error getting pending count:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('[Queue] Error in getPendingChunkCount:', error);
    return 0;
  }
}
