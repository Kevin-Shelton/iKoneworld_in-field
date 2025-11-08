import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Upload a document to Supabase Storage
 */
export async function uploadDocumentToSupabase({
  fileBuffer,
  fileName,
  contentType,
  enterpriseId,
  userId,
  conversationId,
  isTranslated,
}: {
  fileBuffer: Buffer;
  fileName: string;
  contentType: string;
  enterpriseId: string;
  userId: number;
  conversationId: number;
  isTranslated: boolean;
}): Promise<string> {
  try {
    const supabase = supabaseAdmin;
    
    // Create a structured path: enterprise/user/conversation/filename
    const folder = isTranslated ? 'translated' : 'original';
    const filePath = `${enterpriseId}/${userId}/${conversationId}/${folder}/${fileName}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('documents') // Bucket name
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: true, // Overwrite if exists
      });
    
    if (error) {
      console.error('Supabase Storage upload error:', error);
      throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);
    }
    
    // Return the full path (we'll generate signed URLs when needed)
    return filePath;
    
  } catch (error) {
    console.error('Error uploading to Supabase Storage:', error);
    throw error;
  }
}

/**
 * Get a signed download URL for a document
 */
export async function getDocumentDownloadUrl(
  filePath: string,
  expiresIn: number = 86400 // 24 hours default
): Promise<string> {
  try {
    const supabase = supabaseAdmin;
    
    // Generate signed URL
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, expiresIn);
    
    if (error) {
      console.error('Supabase Storage signed URL error:', error);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
    
    if (!data?.signedUrl) {
      throw new Error('No signed URL returned from Supabase Storage');
    }
    
    return data.signedUrl;
    
  } catch (error) {
    console.error('Error generating download URL:', error);
    throw error;
  }
}

/**
 * Delete a document from Supabase Storage
 */
export async function deleteDocumentFromSupabase(filePath: string): Promise<void> {
  try {
    const supabase = supabaseAdmin;
    
    const { error } = await supabase.storage
      .from('documents')
      .remove([filePath]);
    
    if (error) {
      console.error('Supabase Storage delete error:', error);
      throw new Error(`Failed to delete from Supabase Storage: ${error.message}`);
    }
    
    console.log('[Supabase Storage] Deleted file:', filePath);
    
  } catch (error) {
    console.error('Error deleting from Supabase Storage:', error);
    throw error;
  }
}

/**
 * Get public URL for a document (if bucket is public)
 */
export async function getDocumentPublicUrl(filePath: string): Promise<string> {
  try {
    const supabase = supabaseAdmin;
    
    const { data } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);
    
    return data.publicUrl;
    
  } catch (error) {
    console.error('Error getting public URL:', error);
    throw error;
  }
}

/**
 * List documents in a folder
 */
export async function listDocuments(folderPath: string): Promise<any[]> {
  try {
    const supabase = supabaseAdmin;
    
    const { data, error } = await supabase.storage
      .from('documents')
      .list(folderPath);
    
    if (error) {
      console.error('Supabase Storage list error:', error);
      throw new Error(`Failed to list documents: ${error.message}`);
    }
    
    return data || [];
    
  } catch (error) {
    console.error('Error listing documents:', error);
    throw error;
  }
}

/**
 * Get storage usage for a user
 */
export async function getUserStorageUsage(
  enterpriseId: string,
  userId: number
): Promise<number> {
  try {
    const supabase = supabaseAdmin;
    
    const folderPath = `${enterpriseId}/${userId}`;
    const { data, error } = await supabase.storage
      .from('documents')
      .list(folderPath, {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' },
      });
    
    if (error) {
      console.error('Supabase Storage usage error:', error);
      return 0;
    }
    
    // Sum up file sizes
    const totalBytes = (data || []).reduce((sum: number, file: any) => {
      return sum + (file.metadata?.size || 0);
    }, 0);
    
    return totalBytes;
    
  } catch (error) {
    console.error('Error calculating storage usage:', error);
    return 0;
  }
}
