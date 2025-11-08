import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * POST /api/documents/create-from-storage
 * 
 * Create a document translation record from a file already uploaded to Supabase Storage
 * This endpoint bypasses Vercel's 4.5MB serverless function limit by accepting
 * only metadata instead of the actual file.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      userId,
      enterpriseId,
      fileName,
      fileSize,
      fileType,
      storagePath,
      sourceLanguage,
      targetLanguage,
    } = body;
    
    // Validate inputs
    if (!userId || !fileName || !fileSize || !storagePath || !sourceLanguage || !targetLanguage) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    if (sourceLanguage === targetLanguage) {
      return NextResponse.json(
        { error: 'Source and target languages must be different' },
        { status: 400 }
      );
    }
    
    // Determine file type and method
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['pdf', 'docx', 'pptx', 'txt'];
    
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { 
          error: 'File type not supported',
          allowedTypes: allowedExtensions,
        },
        { status: 400 }
      );
    }
    
    // Validate file size (200MB limit)
    const maxSizeBytes = 200 * 1024 * 1024;
    if (fileSize > maxSizeBytes) {
      return NextResponse.json(
        { 
          error: 'File too large',
          maxSizeMB: 200,
          yourSizeMB: (fileSize / (1024 * 1024)).toFixed(1),
        },
        { status: 400 }
      );
    }
    
    // Determine processing method
    let method = 'unknown';
    if (fileExtension === 'pdf') {
      method = 'pdf-deepl-async';
    } else if (fileExtension === 'pptx') {
      method = 'pptx-deepl-async';
    } else if (fileExtension === 'docx') {
      method = 'docx-deepl-async';
    } else if (fileExtension === 'txt') {
      const fileSizeKB = fileSize / 1024;
      method = fileSizeKB < 100 ? 'txt-verbum-sync' : 'txt-verbum-async';
    }
    
    console.log('[Create From Storage] Creating document record:', {
      fileName,
      fileSize,
      method,
      storagePath,
    });
    
    // Create conversation record in database
    const supabase = supabaseAdmin;
    
    const { data: conversation, error: dbError } = await supabase
      .from('conversations')
      .insert({
        userId: parseInt(userId),
        enterprise_id: enterpriseId || null,
        language1: sourceLanguage,
        language2: targetLanguage,
        status: 'active',
        metadata: {
          conversation_type: 'document',
          original_filename: fileName,
          file_size: fileSize,
          file_type: fileType || 'application/octet-stream',
          source_language: sourceLanguage,
          target_language: targetLanguage,
          original_storage_path: storagePath,
          method: method,
          uploaded_via: 'client-direct',
        },
      })
      .select()
      .single();
    
    if (dbError || !conversation) {
      console.error('[Create From Storage] Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to create document record', details: dbError?.message },
        { status: 500 }
      );
    }
    
    console.log('[Create From Storage] Document record created:', conversation.id);
    
    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      method: method,
      storagePath: storagePath,
      message: 'Document record created successfully',
    });
    
  } catch (error: any) {
    console.error('[Create From Storage] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
