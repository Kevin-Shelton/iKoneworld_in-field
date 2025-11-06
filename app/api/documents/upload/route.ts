import { NextRequest, NextResponse } from 'next/server';
import { createDocumentTranslation, storeDocumentChunks } from '@/lib/db/documents';
import { uploadDocumentToSupabase } from '@/lib/supabaseStorage';
import {
  extractTextFromDocument,
  chunkText,
  isValidFileType,
  isValidFileSize,
  sanitizeFilename,
} from '@/lib/documentProcessor';

export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const enterpriseId = formData.get('enterpriseId') as string;
    const sourceLanguage = formData.get('sourceLanguage') as string;
    const targetLanguage = formData.get('targetLanguage') as string;
    
    // Validate required fields
    if (!file || !userId || !enterpriseId || !sourceLanguage || !targetLanguage) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Validate file type
    if (!isValidFileType(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Supported types: PDF, DOC, DOCX, TXT' },
        { status: 400 }
      );
    }
    
    // Validate file size
    if (!isValidFileSize(file.size)) {
      return NextResponse.json(
        { error: 'File size exceeds 100MB limit' },
        { status: 400 }
      );
    }
    
    // Sanitize filename
    const sanitizedFilename = sanitizeFilename(file.name);
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    
    // Extract text from document
    console.log('[Document Upload] Extracting text from document...');
    const extractedText = await extractTextFromDocument(fileBuffer, file.type);
    
    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        { error: 'No text could be extracted from the document' },
        { status: 400 }
      );
    }
    
    console.log('[Document Upload] Extracted text length:', extractedText.length);
    
    // Create document translation record
    const conversation = await createDocumentTranslation({
      userId: parseInt(userId),
      enterpriseId,
      originalFilename: sanitizedFilename,
      fileType: file.type,
      fileSizeBytes: file.size,
      sourceLanguage,
      targetLanguage,
      originalFileUrl: '', // Will be updated after S3 upload
    });
    
    console.log('[Document Upload] Created conversation:', conversation.id);
    
    // Upload original document to Supabase Storage
    const storagePath = await uploadDocumentToSupabase({
      fileBuffer,
      fileName: sanitizedFilename,
      contentType: file.type,
      enterpriseId,
      userId: parseInt(userId),
      conversationId: conversation.id,
      isTranslated: false,
    });
    
    console.log('[Document Upload] Uploaded to Supabase Storage:', storagePath);
    
    // Update conversation with storage path
    const { supabaseAdmin } = await import('@/lib/supabase/server');
    const supabase = supabaseAdmin;
    await supabase
      .from('conversations')
      .update({ audio_url: storagePath })
      .eq('id', conversation.id);
    
    // Chunk the text for translation
    const chunks = chunkText(extractedText);
    console.log('[Document Upload] Split into', chunks.length, 'chunks');
    
    // Store chunks as conversation messages
    await storeDocumentChunks({
      conversationId: conversation.id,
      chunks,
      sourceLanguage,
    });
    
    console.log('[Document Upload] Stored chunks in database');
    
    // Return success response with conversation ID
    // The translation will be triggered by a separate process
    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      message: 'Document uploaded successfully. Translation will begin shortly.',
      chunksCount: chunks.length,
    });
    
  } catch (error) {
    console.error('[Document Upload] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload document',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Configure Next.js to handle larger file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};
