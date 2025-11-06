import { NextRequest, NextResponse } from 'next/server';
import { getDocumentTranslation, deleteDocumentTranslation } from '@/lib/db/documents';
import { deleteDocumentFromS3 } from '@/lib/s3';

/**
 * GET /api/documents/[id]
 * Get a specific document translation
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
    
    const document = await getDocumentTranslation(conversationId);
    
    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }
    
    // Transform to frontend-friendly format
    const transformedDocument = {
      id: document.id,
      userId: document.userId,
      enterpriseId: document.enterprise_id,
      originalFilename: document.metadata?.document_translation?.original_filename || 'Unknown',
      fileType: document.metadata?.document_translation?.file_type || 'Unknown',
      fileSizeBytes: document.metadata?.document_translation?.file_size_bytes || 0,
      sourceLanguage: document.language1,
      targetLanguage: document.language2,
      status: document.status,
      originalFileUrl: document.audio_url,
      translatedFileUrl: document.metadata?.document_translation?.translated_file_url,
      progressPercentage: document.metadata?.document_translation?.progress_percentage || 0,
      queuePosition: document.metadata?.document_translation?.queue_position,
      errorMessage: document.metadata?.document_translation?.error_message,
      startedAt: document.startedAt,
      completedAt: document.endedAt,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
    
    return NextResponse.json({
      success: true,
      document: transformedDocument,
    });
    
  } catch (error) {
    console.error('[Document GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch document',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/[id]
 * Delete a document translation
 */
export async function DELETE(
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
    
    // Get document to retrieve S3 URLs
    const document = await getDocumentTranslation(conversationId);
    
    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }
    
    // Delete files from S3
    try {
      if (document.audio_url) {
        await deleteDocumentFromS3(document.audio_url);
      }
      
      const translatedUrl = document.metadata?.document_translation?.translated_file_url;
      if (translatedUrl) {
        await deleteDocumentFromS3(translatedUrl);
      }
    } catch (s3Error) {
      console.error('[Document DELETE] Error deleting from S3:', s3Error);
      // Continue with database deletion even if S3 deletion fails
    }
    
    // Delete from database
    await deleteDocumentTranslation(conversationId);
    
    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });
    
  } catch (error) {
    console.error('[Document DELETE] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete document',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
