import { NextRequest, NextResponse } from 'next/server';
import { getFileSizeCategory, estimateProcessingTime, stripDocument, buildDocument } from '@/lib/skeletonDocumentProcessor';
import { extractTextFromDocx, processDocxTranslation } from '@/lib/mammothDocumentProcessor';
import { extractDocumentXml, createModifiedDocx, validateDocxStructure } from '@/lib/docxHandler';
import { createDocumentTranslation, storeDocumentChunks, failDocumentTranslation } from '@/lib/db/documents';
import { uploadDocumentToSupabase } from '@/lib/supabaseStorage';
import {
  chunkText,
  isValidFileType,
  isValidFileSize,
  sanitizeFilename,
} from '@/lib/documentUtils';

/**
 * POST /api/documents/upload-smart
 * 
 * Smart routing upload handler
 * 
 * This endpoint analyzes the uploaded file and routes it to the appropriate
 * translation method:
 * - Small DOCX files (< 100KB) → Skeleton method (sync, fast)
 * - Medium/Large files or non-DOCX → Chunking method (async)
 * 
 * Returns routing decision and processing instructions
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sourceLanguage = formData.get('sourceLanguage') as string;
    const targetLanguage = formData.get('targetLanguage') as string;
    const userId = formData.get('userId') as string;
    const enterpriseId = formData.get('enterpriseId') as string | null;
    
    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    if (!sourceLanguage || !targetLanguage) {
      return NextResponse.json(
        { error: 'Source and target languages are required' },
        { status: 400 }
      );
    }
    
    if (sourceLanguage === targetLanguage) {
      return NextResponse.json(
        { error: 'Source and target languages must be different' },
        { status: 400 }
      );
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Analyze file
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const sizeCategory = getFileSizeCategory(file.size);
    const estimatedTime = estimateProcessingTime(file.size);
    
    // Routing decision
    // Only use skeleton method for small files (< 100KB) to avoid Verbum API size limits
    const useSkeletonMethod = 
      fileExtension === 'docx' && 
      sizeCategory === 'small';
    
    console.log('[Upload Smart] File analysis:', {
      name: file.name,
      size: file.size,
      sizeCategory,
      extension: fileExtension,
      method: useSkeletonMethod ? 'skeleton' : 'chunking',
      estimatedTime: `${estimatedTime}s`,
    });
    
    if (useSkeletonMethod) {
      // ============================================
      // SKELETON METHOD (Synchronous)
      // ============================================
      console.log('[Upload Smart] Using skeleton method');
      
      try {
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Validate DOCX structure
      const validation = await validateDocxStructure(buffer);
      if (!validation.isValid) {
        return NextResponse.json(
          { 
            error: 'Invalid DOCX file structure',
            details: validation.errors,
          },
          { status: 400 }
        );
      }
      
      // Step 1: Check if API key is configured
      if (!process.env.VERBUM_API_KEY) {
        console.error('[Upload Smart] VERBUM_API_KEY not configured');
        return NextResponse.json(
          {
            error: 'Translation service not configured',
            message: 'VERBUM_API_KEY environment variable is missing. Please configure it in Vercel settings.',
            hint: 'Go to Vercel Dashboard → Project Settings → Environment Variables',
          },
          { status: 500 }
        );
      }
      
      // Step 2: Extract text to check size
      console.log('[Upload Smart] Step 1: Extracting text to check size');
      const parsed = await extractTextFromDocx(buffer);
      console.log(`[Upload Smart] Extracted text length: ${parsed.length} characters`);
      
      // Check if text is too large for Verbum API (max ~50k characters)
      const MAX_TEXT_LENGTH = 50000;
      if (parsed.length > MAX_TEXT_LENGTH) {
        console.log(`[Upload Smart] Text too large (${parsed.length} chars), falling back to chunking method`);
        throw new Error('TEXT_TOO_LARGE');
      }
      
      // Step 3: Process document with formatting preservation
      console.log('[Upload Smart] Step 2: Processing document with formatting preservation');
      console.log('[Upload Smart] Source language:', sourceLanguage);
      console.log('[Upload Smart] Target language:', targetLanguage);
      
      // Create translation function that calls Verbum API
      const translateFn = async (text: string): Promise<string> => {
        console.log('[Upload Smart] Translating text segment, length:', text.length);
        
        const response = await fetch(
          'https://sdk.verbum.ai/v1/translator/translate',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.VERBUM_API_KEY!,
            },
            body: JSON.stringify({
              texts: [{ text }],
              from: sourceLanguage,
              to: [targetLanguage],
            }),
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Upload Smart] Translation API error:', errorText);
          throw new Error(`Translation API failed: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.translations?.[0]?.[0]?.text) {
          console.error('[Upload Smart] Invalid translation response:', data);
          throw new Error('Invalid translation response from Verbum API');
        }
        
        return data.translations[0][0].text;
      };
      
      // Process document with formatting preservation
      const result = await processDocxTranslation(buffer, translateFn);
      const translatedBuffer = result.translatedBuffer;
      const translatedText = result.translatedText;
      
      console.log(`[Upload Smart] ✓ Translation completed with formatting preserved`);
      console.log(`[Upload Smart] Original text: ${result.originalText.length} chars`);
      console.log(`[Upload Smart] Translated text: ${translatedText.length} chars`);
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const originalName = file.name.replace('.docx', '');
      const newFilename = `${originalName}_${sourceLanguage.toUpperCase()}_to_${targetLanguage.toUpperCase()}_${timestamp}.docx`;
      
      const processingTime = Date.now() - startTime;
      console.log(`[Upload Smart] ✓ Translation completed in ${processingTime}ms`);
      console.log(`[Upload Smart] Output file: ${newFilename} (${translatedBuffer.length} bytes)`);
      
      // Step 6: Create database record first to get conversation ID
      console.log('[Upload Smart] Step 6: Creating database record');
      const conversation = await createDocumentTranslation({
        userId: parseInt(userId),
        enterpriseId: enterpriseId || undefined,
        originalFilename: file.name,
        fileType: 'docx',
        fileSizeBytes: file.size,
        sourceLanguage,
        targetLanguage,
        originalFileUrl: '', // Will be updated after upload
      });
      
      // Step 7: Upload translated file to Supabase Storage with correct conversation ID
      console.log('[Upload Smart] Step 7: Uploading translated file to storage');
      const translatedStoragePath = await uploadDocumentToSupabase({
        fileBuffer: translatedBuffer,
        fileName: newFilename,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        enterpriseId: enterpriseId || 'default',
        userId: parseInt(userId),
        conversationId: conversation.id,
        isTranslated: true,
      });
      
      // Update to completed status with full metadata
      const { supabaseAdmin } = await import('@/lib/supabase/server');
      const supabase = supabaseAdmin;
      await supabase
        .from('conversations')
        .update({
          status: 'completed',
          audio_url: translatedStoragePath, // Store path for download
          metadata: {
            conversation_type: 'document',
            document_translation: {
              original_filename: file.name,
              translated_filename: newFilename,
              file_type: 'docx',
              file_size_bytes: file.size,
              translated_file_size_bytes: translatedBuffer.length,
              translated_storage_path: translatedStoragePath,
              translated_file_url: translatedStoragePath,
              progress_percentage: 100,
              processing_time_ms: processingTime,
              method: 'skeleton',
              estimated_time_seconds: estimatedTime,
              chunk_count: 1,
            },
          },
        })
        .eq('id', conversation.id);
      
      console.log(`[Upload Smart] ✓ Document saved with ID: ${conversation.id}`);
      
      // Return JSON response
      return NextResponse.json({
        success: true,
        conversationId: conversation.id,
        filename: newFilename,
        processingTime,
        method: 'skeleton',
        status: 'completed',
      });
      
      } catch (skeletonError) {
        console.error('[Upload Smart] Skeleton method error:', skeletonError);
        
        // If text is too large, fall back to chunking method
        if (skeletonError instanceof Error && skeletonError.message === 'TEXT_TOO_LARGE') {
          console.log('[Upload Smart] Falling back to chunking method due to text size');
          // Continue to chunking method below (don't return error)
        } else {
          // Other errors - return error response
          return NextResponse.json(
            {
              error: 'Skeleton translation failed',
              message: skeletonError instanceof Error ? skeletonError.message : 'Unknown error during skeleton translation',
              method: 'skeleton',
              fileSize: file.size,
              fileName: file.name,
              stack: skeletonError instanceof Error ? skeletonError.stack : undefined,
            },
            { status: 500 }
          );
        }
      }
      
    } else {
      // ============================================
      // CHUNKING METHOD (Asynchronous)
      // ============================================
      console.log('[Upload Smart] Using chunking method');
      
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
      
      // Extract content from document (HTML for DOCX to preserve formatting)
      console.log('[Upload Smart] Extracting content from document...');
      
      // For DOCX files, extract HTML to preserve formatting
      // For other files, extract plain text
      const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                     file.type === 'application/msword';
      
      let extractedContent: string;
      let isHtmlContent = false;
      
      if (isDocx) {
        console.log('[Upload Smart] Extracting HTML from DOCX to preserve formatting');
        const { extractHtmlFromDocument } = await import('@/lib/documentProcessor');
        extractedContent = await extractHtmlFromDocument(fileBuffer, file.type);
        isHtmlContent = true;
        console.log('[Upload Smart] Extracted HTML length:', extractedContent.length);
      } else {
        console.log('[Upload Smart] Extracting plain text from document');
        const { extractTextFromDocument } = await import('@/lib/documentUtils');
        extractedContent = await extractTextFromDocument(fileBuffer, file.type);
        isHtmlContent = false;
        console.log('[Upload Smart] Extracted text length:', extractedContent.length);
      }
      
      if (!extractedContent || extractedContent.trim().length === 0) {
        return NextResponse.json(
          { error: 'No content could be extracted from the document' },
          { status: 400 }
        );
      }
      
      // Create document translation record
      const conversation = await createDocumentTranslation({
        userId: parseInt(userId),
        enterpriseId: enterpriseId || undefined,
        originalFilename: sanitizedFilename,
        fileType: file.type,
        fileSizeBytes: file.size,
        sourceLanguage,
        targetLanguage,
        originalFileUrl: '', // Will be updated after S3 upload
      });
      
      console.log('[Upload Smart] Created conversation:', conversation.id);
      
      // Upload original file to Supabase
      const uploadedFileUrl = await uploadDocumentToSupabase({
        fileBuffer,
        fileName: sanitizedFilename,
        contentType: file.type,
        enterpriseId: enterpriseId || 'default',
        userId: parseInt(userId),
        conversationId: conversation.id,
        isTranslated: false,
      });
      
      console.log('[Upload Smart] Uploaded file to Supabase:', uploadedFileUrl);
      
      // Chunk content for translation (HTML or plain text)
      let chunks: string[];
      
      if (isHtmlContent) {
        const { chunkHtml } = await import('@/lib/documentProcessor');
        chunks = chunkHtml(extractedContent);
        console.log('[Upload Smart] Created HTML chunks:', chunks.length);
      } else {
        chunks = chunkText(extractedContent);
        console.log('[Upload Smart] Created text chunks:', chunks.length);
      }
      
      // Store chunks in database
      await storeDocumentChunks({
        conversationId: conversation.id,
        chunks,
        sourceLanguage,
      });
      console.log('[Upload Smart] Stored chunks in database');
      
      // Update conversation metadata with method and estimates
      const { supabaseAdmin } = await import('@/lib/supabase/server');
      const supabase = supabaseAdmin;
      await supabase
        .from('conversations')
        .update({
          metadata: {
            conversation_type: 'document',
            document_translation: {
              original_filename: sanitizedFilename,
              file_type: file.type,
              file_size_bytes: file.size,
              progress_percentage: 0,
              method: 'chunking',
              chunk_count: chunks.length,
              estimated_time_seconds: estimatedTime,
              is_html_content: isHtmlContent,
            },
          },
        })
        .eq('id', conversation.id);
      
      // Translation will be processed by cron job (/api/cron/process-translations)
      // Chunks are stored with empty translatedText, which marks them as pending
      console.log('[Upload Smart] Document queued for translation. Cron job will process chunks.');
      
      // Return async processing response
      return NextResponse.json({
        success: true,
        method: 'chunking',
        conversationId: conversation.id,
        message: 'Document uploaded. Translation is now processing.',
        estimatedTime: `${estimatedTime} seconds`,
        status: 'processing',
        chunkCount: chunks.length,
      });
    }
    
  } catch (error) {
    console.error('[Upload Smart] Error:', error);
    
    return NextResponse.json(
      {
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Next.js 15 App Router configuration for file uploads
// Increase body size limit and timeout for large file uploads
export const maxDuration = 60; // Maximum execution time in seconds (Vercel Pro: 60s, Hobby: 10s)
export const dynamic = 'force-dynamic'; // Disable caching for upload endpoint
