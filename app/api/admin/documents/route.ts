import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/admin/documents
 * Get all document translations across all users (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin;
    
    // Get all document translations with user information
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        *,
        users (
          id,
          name,
          email
        )
      `)
      .eq('metadata->>conversation_type', 'document')
      .order('createdAt', { ascending: false });
    
    if (error) {
      console.error('[Admin Documents] Error fetching documents:', error);
      throw error;
    }
    
    // Transform data to include user info and document metadata
    const documents = conversations.map((conv: any) => ({
      id: conv.id,
      userId: conv.userId,
      userName: conv.users?.name || 'Unknown',
      userEmail: conv.users?.email || 'N/A',
      originalFilename: conv.metadata?.document_translation?.original_filename || 'Unknown',
      fileType: conv.metadata?.document_translation?.file_type || 'Unknown',
      fileSizeBytes: conv.metadata?.document_translation?.file_size_bytes || 0,
      sourceLanguage: conv.language1,
      targetLanguage: conv.language2,
      status: conv.status,
      progressPercentage: conv.metadata?.document_translation?.progress_percentage || 0,
      errorMessage: conv.metadata?.document_translation?.error_message,
      createdAt: conv.createdAt,
      startedAt: conv.startedAt,
      endedAt: conv.endedAt,
      originalFileUrl: conv.audio_url,
      translatedFileUrl: conv.metadata?.document_translation?.translated_file_url,
    }));
    
    // Calculate queue statistics
    const stats = {
      total: documents.length,
      queued: documents.filter((d: any) => d.status === 'queued').length,
      active: documents.filter((d: any) => d.status === 'active').length,
      completed: documents.filter((d: any) => d.status === 'completed').length,
      failed: documents.filter((d: any) => d.status === 'failed').length,
    };
    
    return NextResponse.json({
      success: true,
      documents,
      stats,
    });
    
  } catch (error) {
    console.error('[Admin Documents] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch documents',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
