import { NextRequest, NextResponse } from 'next/server';
import { getDocumentTranslations, getDocumentStats } from '@/lib/db/documents';

/**
 * GET /api/documents
 * List all document translations for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const statsOnly = searchParams.get('statsOnly') === 'true';
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }
    
    const userIdNum = parseInt(userId);
    
    // If requesting stats only
    if (statsOnly) {
      const stats = await getDocumentStats(userIdNum);
      return NextResponse.json(stats);
    }
    
    // Get all documents
    const documents = await getDocumentTranslations(userIdNum);
    
    // Transform the data to a more frontend-friendly format
    const transformedDocuments = documents.map(doc => ({
      id: doc.id,
      userId: doc.userId,
      enterpriseId: doc.enterprise_id,
      originalFilename: doc.metadata?.document_translation?.original_filename || 'Unknown',
      fileType: doc.metadata?.document_translation?.file_type || 'Unknown',
      fileSizeBytes: doc.metadata?.document_translation?.file_size_bytes || 0,
      sourceLanguage: doc.language1,
      targetLanguage: doc.language2,
      status: doc.status,
      originalFileUrl: doc.audio_url,
      translatedFileUrl: doc.metadata?.document_translation?.translated_file_url,
      progressPercentage: doc.metadata?.document_translation?.progress_percentage || 0,
      queuePosition: doc.metadata?.document_translation?.queue_position,
      errorMessage: doc.metadata?.document_translation?.error_message,
      startedAt: doc.startedAt,
      completedAt: doc.endedAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
    
    return NextResponse.json({
      success: true,
      documents: transformedDocuments,
    });
    
  } catch (error) {
    console.error('[Documents API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch documents',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
