import { supabaseAdmin } from '@/lib/supabase/server';

export interface DocumentTranslation {
  id: number;
  userId: number;
  enterpriseId: string;
  originalFilename: string;
  fileType: string;
  fileSizeBytes: number;
  sourceLanguage: string;
  targetLanguage: string;
  status: 'active' | 'completed' | 'failed';
  originalFileUrl: string;
  translatedFileUrl?: string;
  progressPercentage: number;
  queuePosition?: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a new document translation record
 */
export async function createDocumentTranslation({
  userId,
  enterpriseId,
  originalFilename,
  fileType,
  fileSizeBytes,
  sourceLanguage,
  targetLanguage,
  originalFileUrl,
}: {
  userId: number;
  enterpriseId: string;
  originalFilename: string;
  fileType: string;
  fileSizeBytes: number;
  sourceLanguage: string;
  targetLanguage: string;
  originalFileUrl: string;
}) {
  const supabase = supabaseAdmin;
  
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      userId,
      enterprise_id: enterpriseId,
      language1: sourceLanguage,
      language2: targetLanguage,
      status: 'active',
      audio_url: originalFileUrl, // Repurpose for document URL
      metadata: {
        conversation_type: 'document',
        document_translation: {
          original_filename: originalFilename,
          file_type: fileType,
          file_size_bytes: fileSizeBytes,
          progress_percentage: 0,
          queue_position: null,
        },
      },
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating document translation:', error);
    throw new Error('Failed to create document translation record');
  }
  
  return data;
}

/**
 * Update document translation progress
 */
export async function updateDocumentProgress({
  conversationId,
  progressPercentage,
  queuePosition,
}: {
  conversationId: number;
  progressPercentage: number;
  queuePosition?: number;
}) {
  const supabase = supabaseAdmin;
  
  // Get current metadata
  const { data: current } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .single();
  
  if (!current) {
    throw new Error('Document translation not found');
  }
  
  const updatedMetadata = {
    ...current.metadata,
    document_translation: {
      ...current.metadata.document_translation,
      progress_percentage: progressPercentage,
      queue_position: queuePosition,
    },
  };
  
  const { error } = await supabase
    .from('conversations')
    .update({
      metadata: updatedMetadata,
      updatedAt: new Date().toISOString(),
    })
    .eq('id', conversationId);
  
  if (error) {
    console.error('Error updating document progress:', error);
    throw new Error('Failed to update document progress');
  }
}

/**
 * Complete document translation
 */
export async function completeDocumentTranslation({
  conversationId,
  translatedFileUrl,
}: {
  conversationId: number;
  translatedFileUrl: string;
}) {
  const supabase = supabaseAdmin;
  
  // Get current metadata
  const { data: current } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .single();
  
  if (!current) {
    throw new Error('Document translation not found');
  }
  
  const updatedMetadata = {
    ...current.metadata,
    document_translation: {
      ...current.metadata.document_translation,
      translated_file_url: translatedFileUrl,
      progress_percentage: 100,
    },
  };
  
  const { error } = await supabase
    .from('conversations')
    .update({
      status: 'completed',
      metadata: updatedMetadata,
      endedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .eq('id', conversationId);
  
  if (error) {
    console.error('Error completing document translation:', error);
    throw new Error('Failed to complete document translation');
  }
}

/**
 * Mark document translation as failed
 */
export async function failDocumentTranslation({
  conversationId,
  errorMessage,
}: {
  conversationId: number;
  errorMessage: string;
}) {
  const supabase = supabaseAdmin;
  
  // Get current metadata
  const { data: current } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .single();
  
  if (!current) {
    throw new Error('Document translation not found');
  }
  
  const updatedMetadata = {
    ...current.metadata,
    document_translation: {
      ...current.metadata.document_translation,
      error_message: errorMessage,
    },
  };
  
  const { error } = await supabase
    .from('conversations')
    .update({
      status: 'failed',
      metadata: updatedMetadata,
      endedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .eq('id', conversationId);
  
  if (error) {
    console.error('Error marking document as failed:', error);
    throw new Error('Failed to mark document as failed');
  }
}

/**
 * Get document translations for a user
 */
export async function getDocumentTranslations(userId: number) {
  const supabase = supabaseAdmin;
  
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('userId', userId)
    .eq('metadata->>conversation_type', 'document')
    .order('createdAt', { ascending: false });
  
  if (error) {
    console.error('Error fetching document translations:', error);
    throw new Error('Failed to fetch document translations');
  }
  
  return data;
}

/**
 * Get a single document translation
 */
export async function getDocumentTranslation(conversationId: number) {
  const supabase = supabaseAdmin;
  
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('metadata->>conversation_type', 'document')
    .single();
  
  if (error) {
    console.error('Error fetching document translation:', error);
    throw new Error('Failed to fetch document translation');
  }
  
  return data;
}

/**
 * Delete a document translation
 */
export async function deleteDocumentTranslation(conversationId: number) {
  const supabase = supabaseAdmin;
  
  // Delete conversation messages first
  await supabase
    .from('conversation_messages')
    .delete()
    .eq('conversationId', conversationId);
  
  // Delete conversation
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);
  
  if (error) {
    console.error('Error deleting document translation:', error);
    throw new Error('Failed to delete document translation');
  }
}

/**
 * Get document translation statistics
 */
export async function getDocumentStats(userId: number) {
  const supabase = supabaseAdmin;
  
  const { data, error } = await supabase
    .from('conversations')
    .select('status, metadata')
    .eq('userId', userId)
    .eq('metadata->>conversation_type', 'document');
  
  if (error) {
    console.error('Error fetching document stats:', error);
    throw new Error('Failed to fetch document stats');
  }
  
  const stats = {
    totalDocuments: data.length,
    completedDocuments: data.filter((d: any) => d.status === 'completed').length,
    activeTranslations: data.filter((d: any) => d.status === 'active').length,
    failedDocuments: data.filter((d: any) => d.status === 'failed').length,
    totalStorageBytes: data.reduce((sum: number, d: any) => {
      return sum + (d.metadata?.document_translation?.file_size_bytes || 0);
    }, 0),
  };
  
  return stats;
}

/**
 * Store document text chunks as conversation messages
 */
export async function storeDocumentChunks({
  conversationId,
  chunks,
  sourceLanguage,
}: {
  conversationId: number;
  chunks: string[];
  sourceLanguage: string;
}) {
  const supabase = supabaseAdmin;
  
  const messages = chunks.map((chunk, index) => ({
    conversationId,
    speaker: 'user',
    original_text: chunk,
    source_language: sourceLanguage,
    metadata: {
      chunk_index: index,
      chunk_total: chunks.length,
    },
  }));
  
  const { error } = await supabase
    .from('conversation_messages')
    .insert(messages);
  
  if (error) {
    console.error('Error storing document chunks:', error);
    throw new Error('Failed to store document chunks');
  }
}

/**
 * Store translated chunks
 */
export async function storeTranslatedChunks({
  conversationId,
  translatedChunks,
  targetLanguage,
}: {
  conversationId: number;
  translatedChunks: string[];
  targetLanguage: string;
}) {
  const supabase = supabaseAdmin;
  
  // Get existing messages
  const { data: messages } = await supabase
    .from('conversation_messages')
    .select('*')
    .eq('conversationId', conversationId)
    .order('id', { ascending: true });
  
  if (!messages || messages.length !== translatedChunks.length) {
    throw new Error('Mismatch between original and translated chunks');
  }
  
  // Update each message with translated text
  for (let i = 0; i < messages.length; i++) {
    await supabase
      .from('conversation_messages')
      .update({
        translated_text: translatedChunks[i],
        target_language: targetLanguage,
      })
      .eq('id', messages[i].id);
  }
}
