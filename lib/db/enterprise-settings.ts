import { supabaseAdmin } from '../supabase/server';

export interface EnterpriseSettings {
  id: number;
  enterprise_id: string;
  enable_audio_recording: boolean;
  enable_message_audio: boolean;
  enable_transcripts: boolean;
  save_transcripts_to_db: boolean;
  audio_access_roles: string[];
  transcript_access_roles: string[];
  audio_retention_days: number | null;
  transcript_retention_days: number | null;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
}

export interface UpdateEnterpriseSettingsParams {
  enable_audio_recording?: boolean;
  enable_message_audio?: boolean;
  enable_transcripts?: boolean;
  save_transcripts_to_db?: boolean;
  audio_access_roles?: string[];
  transcript_access_roles?: string[];
  audio_retention_days?: number | null;
  transcript_retention_days?: number | null;
  updated_by?: number;
}

/**
 * Get enterprise settings by enterprise ID
 * Creates default settings if none exist
 */
export async function getEnterpriseSettings(enterpriseId: string): Promise<EnterpriseSettings> {
  const { data, error } = await supabaseAdmin
    .from('enterprise_settings')
    .select('*')
    .eq('enterprise_id', enterpriseId)
    .single();

  if (error) {
    // If no settings exist, create default settings
    if (error.code === 'PGRST116') {
      return await createDefaultEnterpriseSettings(enterpriseId);
    }
    console.error('Error fetching enterprise settings:', error);
    throw error;
  }

  return data;
}

/**
 * Create default enterprise settings
 */
export async function createDefaultEnterpriseSettings(enterpriseId: string): Promise<EnterpriseSettings> {
  const { data, error } = await supabaseAdmin
    .from('enterprise_settings')
    .insert({
      enterprise_id: enterpriseId,
      enable_audio_recording: true,
      enable_message_audio: false,
      enable_transcripts: true,
      save_transcripts_to_db: true,
      audio_access_roles: [
        'enterprise_admin',
        'regional_director',
        'area_manager',
        'district_manager',
        'store_manager',
        'field_sales',
        'retail_staff'
      ],
      transcript_access_roles: [
        'enterprise_admin',
        'regional_director',
        'area_manager',
        'district_manager',
        'store_manager',
        'field_sales',
        'retail_staff',
        'viewer'
      ],
      audio_retention_days: null,
      transcript_retention_days: null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating default enterprise settings:', error);
    throw error;
  }

  return data;
}

/**
 * Update enterprise settings
 * Only admins should be able to call this
 */
export async function updateEnterpriseSettings(
  enterpriseId: string,
  updates: UpdateEnterpriseSettingsParams
): Promise<EnterpriseSettings> {
  const { data, error } = await supabaseAdmin
    .from('enterprise_settings')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('enterprise_id', enterpriseId)
    .select()
    .single();

  if (error) {
    console.error('Error updating enterprise settings:', error);
    throw error;
  }

  return data;
}

/**
 * Check if a user has permission to access audio recordings
 */
export async function canUserAccessAudio(userId: number, enterpriseId: string): Promise<boolean> {
  try {
    // Get user role
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Error fetching user role:', userError);
      return false;
    }

    // Get enterprise settings
    const settings = await getEnterpriseSettings(enterpriseId);

    // Check if audio recording is enabled
    if (!settings.enable_audio_recording) {
      return false;
    }

    // Check if user's role is in the allowed roles
    return settings.audio_access_roles.includes(user.role);
  } catch (error) {
    console.error('Error checking audio access:', error);
    return false;
  }
}

/**
 * Check if a user has permission to access transcripts
 */
export async function canUserAccessTranscripts(userId: number, enterpriseId: string): Promise<boolean> {
  try {
    // Get user role
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Error fetching user role:', userError);
      return false;
    }

    // Get enterprise settings
    const settings = await getEnterpriseSettings(enterpriseId);

    // Check if transcripts are enabled
    if (!settings.enable_transcripts) {
      return false;
    }

    // Check if user's role is in the allowed roles
    return settings.transcript_access_roles.includes(user.role);
  } catch (error) {
    console.error('Error checking transcript access:', error);
    return false;
  }
}

/**
 * Check if a user is an admin for their enterprise
 */
export async function isUserAdmin(userId: number): Promise<boolean> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return false;
    }

    return user.role === 'enterprise_admin' || user.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Get all enterprise settings (for super admin)
 */
export async function getAllEnterpriseSettings(): Promise<EnterpriseSettings[]> {
  const { data, error } = await supabaseAdmin
    .from('enterprise_settings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all enterprise settings:', error);
    throw error;
  }

  return data || [];
}

/**
 * Delete old audio files based on retention policy
 * This should be run as a scheduled job
 */
export async function cleanupOldAudioFiles(enterpriseId: string): Promise<void> {
  try {
    const settings = await getEnterpriseSettings(enterpriseId);

    if (!settings.audio_retention_days) {
      // No retention policy, keep all files
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - settings.audio_retention_days);

    // Find conversations older than retention period
    const { data: oldConversations, error } = await supabaseAdmin
      .from('conversations')
      .select('id, audio_url, enterprise_id')
      .eq('enterprise_id', enterpriseId)
      .lt('endedAt', cutoffDate.toISOString())
      .not('audio_url', 'is', null);

    if (error) {
      console.error('Error finding old conversations:', error);
      return;
    }

    // Delete audio files from storage
    for (const conversation of oldConversations || []) {
      if (conversation.audio_url) {
        try {
          // Extract file path from URL
          const url = new URL(conversation.audio_url);
          const pathParts = url.pathname.split('/audio-recordings/');
          if (pathParts.length > 1) {
            const filePath = pathParts[1];
            
            await supabaseAdmin.storage
              .from('audio-recordings')
              .remove([filePath]);

            // Clear audio_url from database
            await supabaseAdmin
              .from('conversations')
              .update({ audio_url: null })
              .eq('id', conversation.id);
          }
        } catch (err) {
          console.error(`Error deleting audio for conversation ${conversation.id}:`, err);
        }
      }
    }

    console.log(`Cleaned up ${oldConversations?.length || 0} old audio files for enterprise ${enterpriseId}`);
  } catch (error) {
    console.error('Error in cleanup job:', error);
  }
}
