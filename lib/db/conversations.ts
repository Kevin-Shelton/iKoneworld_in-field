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
      language1: params.userLanguage,
      language2: params.guestLanguage,
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
export async function endConversation(conversationId: number, audioUrl?: string | null) {
  const updateData: any = {
    status: 'completed',
    endedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Add audio URL if provided
  if (audioUrl) {
    updateData.audio_url = audioUrl;
  }

  const { data, error} = await supabaseAdmin
    .from('conversations')
    .update(updateData)
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

  // Store relative file paths for client-side URL generation
  // The client will use Supabase client to generate authenticated URLs
  // This enables persistent audio access based on RLS policies
  if (data) {
    const messagesWithFilePaths = data.map((message: any) => {
      if (message.audio_url) {
        try {
          // Extract the file path from the public URL
          const url = new URL(message.audio_url);
          const pathParts = url.pathname.split('/audio-recordings/');
          if (pathParts.length > 1) {
            // Store the relative file path
            message.audio_file_path = pathParts[1];
          }
        } catch (err) {
          console.error('Error processing message audio URL:', err);
        }
      }
      return message;
    });
    return messagesWithFilePaths;
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

  // Store relative file paths for client-side URL generation
  // The client will use Supabase client to generate authenticated URLs
  // This enables persistent audio access based on RLS policies
  if (data) {
    const conversationsWithFilePaths = data.map((conversation: any) => {
      if (conversation.audio_url) {
        try {
          // Check if audio_url is already a storage path (for documents) or a full URL (for audio)
          if (conversation.audio_url.startsWith('http://') || conversation.audio_url.startsWith('https://')) {
            // Extract the file path from the public URL
            const url = new URL(conversation.audio_url);
            const pathParts = url.pathname.split('/audio-recordings/');
            if (pathParts.length > 1) {
              // Store the relative file path
              conversation.audio_file_path = pathParts[1];
            }
          } else {
            // Already a storage path (for documents), use as-is
            conversation.audio_file_path = conversation.audio_url;
          }
        } catch (err) {
          console.error('Error processing audio URL:', err);
        }
      }
      return conversation;
    });
    return conversationsWithFilePaths;
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
