import { supabaseAdmin } from '../supabase/server';

export interface CreateConversationParams {
  userId: number;
  enterpriseId: string;
  storeId?: string;
  departmentId?: string;
  userLanguage: string;
  guestLanguage: string;
}

export interface SaveMessageParams {
  conversationId: number;
  enterpriseId: string;
  userId?: number;
  speaker: 'user' | 'guest';
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  audioUrl?: string;
  audioDurationSeconds?: number;
  confidenceScore?: number;
}

/**
 * Create a new conversation in the database
 */
export async function createConversation(params: CreateConversationParams) {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert({
      userId: params.userId,
      enterprise_id: params.enterpriseId,
      store_id: params.storeId,
      department_id: params.departmentId,
      user_language: params.userLanguage,
      guest_language: params.guestLanguage,
      status: 'active',
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }

  return data;
}

/**
 * Save a conversation message to the database
 */
export async function saveMessage(params: SaveMessageParams) {
  const { data, error } = await supabaseAdmin
    .from('conversation_messages')
    .insert({
      conversationId: params.conversationId,
      enterprise_id: params.enterpriseId,
      user_id: params.userId,
      speaker: params.speaker,
      original_text: params.originalText,
      translated_text: params.translatedText,
      source_language: params.sourceLanguage,
      target_language: params.targetLanguage,
      audio_url: params.audioUrl,
      audio_duration_seconds: params.audioDurationSeconds,
      confidence_score: params.confidenceScore,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving message:', error);
    throw error;
  }

  return data;
}

/**
 * End a conversation and update its status
 */
export async function endConversation(conversationId: number) {
  const { data, error} = await supabaseAdmin
    .from('conversations')
    .update({
      status: 'completed',
      endedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .select()
    .single();

  if (error) {
    console.error('Error ending conversation:', error);
    throw error;
  }

  return data;
}

/**
 * Get conversation messages
 */
export async function getConversationMessages(conversationId: number) {
  const { data, error } = await supabaseAdmin
    .from('conversation_messages')
    .select('*')
    .eq('conversationId', conversationId)
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }

  return data;
}

/**
 * Get all conversations for a specific user
 */
export async function getConversationsByUser(userId: number) {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('userId', userId)
    .order('startedAt', { ascending: false });

  if (error) {
    console.error('Error fetching user conversations:', error);
    throw error;
  }

  return data;
}

/**
 * Upload audio file to Supabase storage
 */
export async function uploadAudio(
  file: Buffer,
  fileName: string,
  enterpriseId: string,
  conversationId: number
): Promise<string> {
  const filePath = `${enterpriseId}/${conversationId}/${fileName}`;

  const { data, error } = await supabaseAdmin.storage
    .from('audio-recordings')
    .upload(filePath, file, {
      contentType: 'audio/webm',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading audio:', error);
    throw error;
  }

  // Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from('audio-recordings')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}
