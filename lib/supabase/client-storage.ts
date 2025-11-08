import { createClient } from '@/lib/supabase/client';

/**
 * Upload a document directly to Supabase Storage from the client
 * This bypasses Vercel's 4.5MB serverless function limit
 */
export async function uploadDocumentToSupabaseClient({
  file,
  fileName,
  enterpriseId,
  userId,
  conversationId,
  isTranslated = false,
}: {
  file: File;
  fileName: string;
  enterpriseId: string;
  userId: number;
  conversationId: number;
  isTranslated?: boolean;
}): Promise<string> {
  try {
    const supabase = createClient();
    
    // Create a structured path: enterprise/user/conversation/filename
    const folder = isTranslated ? 'translated' : 'original';
    const filePath = `${enterpriseId}/${userId}/${conversationId}/${folder}/${fileName}`;
    
    console.log('[Client Storage] Uploading to path:', filePath);
    
    // Upload to Supabase Storage directly from client
    const { data, error } = await supabase.storage
      .from('documents') // Bucket name
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true, // Overwrite if exists
      });
    
    if (error) {
      console.error('[Client Storage] Upload error:', error);
      throw new Error(`Failed to upload to storage: ${error.message}`);
    }
    
    console.log('[Client Storage] Upload successful:', filePath);
    
    // Return the full path
    return filePath;
    
  } catch (error) {
    console.error('[Client Storage] Error uploading:', error);
    throw error;
  }
}

/**
 * Get a signed download URL for a document from the client
 */
export async function getDocumentDownloadUrlClient(
  filePath: string,
  expiresIn: number = 86400 // 24 hours default
): Promise<string> {
  try {
    const supabase = createClient();
    
    // Generate signed URL
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, expiresIn);
    
    if (error) {
      console.error('[Client Storage] Signed URL error:', error);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
    
    if (!data?.signedUrl) {
      throw new Error('No signed URL returned from storage');
    }
    
    return data.signedUrl;
    
  } catch (error) {
    console.error('[Client Storage] Error generating download URL:', error);
    throw error;
  }
}
