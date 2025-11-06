import { NextRequest, NextResponse } from 'next/server';
import { getDocumentTranslation } from '@/lib/db/documents';
import { getDocumentDownloadUrl } from '@/lib/supabaseStorage';

/**
 * GET /api/documents/[id]/download
 * Get a signed download URL for a translated document
 */
export async function GET(
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
    
    // Check if translation is completed
    if (document.status !== 'completed') {
      return NextResponse.json(
        { error: 'Document translation is not yet completed' },
        { status: 400 }
      );
    }
    
    // Get translated file URL from metadata
    const translatedFileUrl = document.metadata?.document_translation?.translated_file_url;
    
    if (!translatedFileUrl) {
      return NextResponse.json(
        { error: 'Translated file URL not found' },
        { status: 404 }
      );
    }
    
    // Generate signed download URL (expires in 24 hours)
    const downloadUrl = await getDocumentDownloadUrl(translatedFileUrl, 86400);
    
    return NextResponse.json({
      success: true,
      downloadUrl,
      filename: document.metadata?.document_translation?.original_filename,
      expiresIn: 86400, // 24 hours in seconds
    });
    
  } catch (error) {
    console.error('[Document Download] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate download URL',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
