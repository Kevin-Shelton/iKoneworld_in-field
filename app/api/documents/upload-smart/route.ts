import { NextRequest, NextResponse } from 'next/server';
import { getFileSizeCategory, estimateProcessingTime, stripDocument, buildDocument } from '@/lib/skeletonDocumentProcessor';
import { extractTextFromDocx, processDocxTranslation } from '@/lib/mammothDocumentProcessor';
import { extractDocumentXml, createModifiedDocx, validateDocxStructure } from '@/lib/docxHandler';
import { createDocumentTranslation, storeDocumentChunks, failDocumentTranslation } from '@/lib/db/documents';
import { processDeeplPdfTranslation } from '@/lib/deeplAsyncPdfTranslator';
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
    // Import Supabase admin client at the top for proper scoping
    const { supabaseAdmin } = await import('@/lib/supabase/server');
    const supabase = supabaseAdmin;
    
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
    // - PDF: Always use DeepL (synchronous)
    // - Small DOCX (< 100KB): Use Verbum AI skeleton method (synchronous)
    // - Large DOCX (>= 100KB): Use Verbum AI chunking method (async)
    const usePdfDeepLMethod = fileExtension === 'pdf';
    const useSkeletonMethod = 
      fileExtension === 'docx' && 
      sizeCategory === 'small';
    const useChunkingMethod = 
      fileExtension === 'docx' && 
      sizeCategory !== 'small';
    
    console.log('[Upload Smart] File analysis:', {
      name: file.name,
      size: file.size,
      sizeCategory,
      extension: fileExtension,
      method: usePdfDeepLMethod ? 'pdf-deepl' : (useSkeletonMethod ? 'skeleton' : 'chunking'),
      estimatedTime: `${estimatedTime}s`,
    });
    
    // Create database record IMMEDIATELY with active status
    console.log('[Upload Smart] Creating database record with active status');
    const conversation = await createDocumentTranslation({
      userId: parseInt(userId),
      enterpriseId: enterpriseId || undefined,
      originalFilename: file.name,
      fileType: fileExtension || 'unknown',
      fileSizeBytes: file.size,
      sourceLanguage,
      targetLanguage,
      originalFileUrl: '', // Will be updated after upload
    });
    
    // Update with method-specific metadata (status already set to 'active' in createDocumentTranslation)
    const { error: metadataError } = await supabase
      .from('conversations')
      .update({
        metadata: {
          conversation_type: 'document',
          document_translation: {
            original_filename: file.name,
            file_type: fileExtension || 'unknown',
            file_size_bytes: file.size,
            progress_percentage: 0,
            method: usePdfDeepLMethod ? 'pdf-deepl' : (useSkeletonMethod ? 'skeleton' : 'chunking'),
            estimated_time_seconds: estimatedTime,
          },
        },
      })
      .eq('id', conversation.id);
    
    if (metadataError) {
      console.error('[Upload Smart] Failed to update metadata:', metadataError);
      throw new Error(`Failed to update conversation metadata: ${metadataError.message}`);
    }
    
    console.log(`[Upload Smart] ✓ Database record created with ID: ${conversation.id}`);
    
    if (usePdfDeepLMethod) {
      // ============================================
      // PDF DEEPL METHOD (Asynchronous)
      // ============================================
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 1. Upload original file to storage
      const originalStoragePath = await uploadDocumentToSupabase({
        fileBuffer: buffer,
        fileName: file.name,
        contentType: 'application/pdf',
        enterpriseId: enterpriseId || 'default',
        userId: parseInt(userId),
        conversationId: conversation.id,
        isTranslated: false,
      });

      // 2. Update conversation metadata with original file path
      const existingMetadata = conversation.metadata || {};
      await supabase.from('conversations').update({
        metadata: {
          ...existingMetadata,
          document_translation: {
            ...existingMetadata.document_translation,
            original_storage_path: originalStoragePath,
            original_filename: file.name,
            file_type: 'pdf',
            file_size_bytes: file.size,
            method: 'pdf-deepl',
          },
        },
      }).eq('id', conversation.id);

      // 3. Return immediate response to user
      return NextResponse.json({
        success: true,
        conversationId: conversation.id,
        method: 'pdf-deepl-async',
        status: 'processing',
      });

    } else if (useSkeletonMethod) {
      // ============================================
      // SKELETON METHOD (Synchronous)
      // ============================================
      console.log('[Upload Smart] Using skeleton method');
      
      // Track processing duration
      const processingStartTime = Date.now();
      
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
      
      // Helper function to update progress
      const updateProgress = async (percentage: number, includeDuration?: boolean) => {
        const metadata: any = {
          conversation_type: 'document',
          document_translation: {
            original_filename: file.name,
            file_type: fileExtension || 'unknown',
            file_size_bytes: file.size,
            progress_percentage: percentage,
            method: 'skeleton',
            estimated_time_seconds: estimatedTime,
          },
        };
        
        // Add duration if requested (for final update)
        if (includeDuration) {
          const processingDurationMs = Date.now() - processingStartTime;
          metadata.document_translation.processing_duration_ms = processingDurationMs;
          metadata.document_translation.processing_duration_seconds = Math.round(processingDurationMs / 1000);
        }
        
        await supabase
          .from('conversations')
          .update({
            status: 'active',
            metadata,
          })
          .eq('id', conversation.id);
      };
      
      // Update status to active with initial progress
      await updateProgress(10);
      
      // Step 3: Process document with formatting preservation
      console.log('[Upload Smart] Step 2: Processing document with formatting preservation');
      console.log('[Upload Smart] Source language:', sourceLanguage);
      console.log('[Upload Smart] Target language:', targetLanguage);
      
      // Track translation progress
      let segmentsTranslated = 0;
      let totalSegments = 0;
      
      // Create translation function that calls Verbum API with progress tracking
      const translateFn = async (text: string): Promise<string> => {
        console.log('[Upload Smart] Translating text segment, length:', text.length);
        
        // Update progress (20% to 80% during translation)
        // Throttle: Only update database every 20 segments to improve performance
        if (totalSegments > 0) {
          segmentsTranslated++;
          const translationProgress = 20 + Math.floor((segmentsTranslated / totalSegments) * 60);
          
          // Only update every 20 segments OR on the last segment
          if (segmentsTranslated % 20 === 0 || segmentsTranslated === totalSegments) {
            await updateProgress(Math.min(translationProgress, 80));
            console.log(`[Upload Smart] Progress update: ${segmentsTranslated}/${totalSegments} segments (${translationProgress}%)`);
          }
        }
        
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
      
      // Update progress: extracting text (15%)
      await updateProgress(15);
      
      // Estimate segments for progress tracking based on file size
      // Approximate: ~50 segments per 10KB of document
      totalSegments = Math.max(Math.floor(file.size / 10240) * 50, 10);
      console.log(`[Upload Smart] Estimated segments for progress: ${totalSegments}`);
      
      // Update progress: starting translation (20%)
      await updateProgress(20);
      
      // Process document with formatting preservation
      const result = await processDocxTranslation(buffer, translateFn);
      const translatedBuffer = result.translatedBuffer;
      const translatedText = result.translatedText;
      
      // Update progress: translation complete, preparing file (85%)
      await updateProgress(85);
      
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
      
      // Update progress: uploading file (90%)
      await updateProgress(90);
      
      // Step 6: Upload translated file to Supabase Storage with correct conversation ID
      console.log('[Upload Smart] Step 6: Uploading translated file to storage');
      const translatedStoragePath = await uploadDocumentToSupabase({
        fileBuffer: translatedBuffer,
        fileName: newFilename,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        enterpriseId: enterpriseId || 'default',
        userId: parseInt(userId),
        conversationId: conversation.id,
        isTranslated: true,
      });
      
      // Calculate final processing duration
      const processingDurationMs = Date.now() - processingStartTime;
      const processingDurationSeconds = Math.round(processingDurationMs / 1000);
      
      console.log(`[Upload Smart] Processing completed in ${processingDurationSeconds}s (${processingDurationMs}ms)`);
      
      // Update to completed status with full metadata
      const { error: updateError } = await supabase
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
              processing_duration_ms: processingDurationMs,
              processing_duration_seconds: processingDurationSeconds,
              method: 'skeleton',
              estimated_time_seconds: estimatedTime,
              chunk_count: 1,
            },
          },
        })
        .eq('id', conversation.id);
      
      if (updateError) {
        console.error('[Upload Smart] Failed to update conversation status:', updateError);
        throw new Error(`Failed to update conversation: ${updateError.message}`);
      }
      
      console.log(`[Upload Smart] ✓ Document saved with ID: ${conversation.id} - Status set to completed`);
      
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
          { error: 'Invalid file type. Supported types: DOCX, PDF, TXT' },
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
        console.log('[Upload Smart] File type:', file.type);
        console.log('[Upload Smart] File size:', file.size, 'bytes');
        
        const isPdf = file.type === 'application/pdf';
        
        try {
          const { extractTextFromDocument } = await import('@/lib/documentUtils');
          extractedContent = await extractTextFromDocument(fileBuffer, file.type);
          isHtmlContent = false;
          console.log('[Upload Smart] Extracted text length:', extractedContent.length);
        } catch (extractError) {
          console.error('[Upload Smart] Text extraction failed:', extractError);
          
          // For PDFs, text extraction is optional since DeepL handles them directly
          if (isPdf) {
            console.log('[Upload Smart] PDF text extraction failed, but continuing (DeepL will handle translation)');
            extractedContent = '[PDF content - will be translated by DeepL]';
            isHtmlContent = false;
          } else {
            throw new Error(`Failed to extract text from ${file.type}: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`);
          }
        }
      }
      
      if (!extractedContent || extractedContent.trim().length === 0) {
        return NextResponse.json(
          { error: 'No content could be extracted from the document' },
          { status: 400 }
        );
      }
      
      console.log('[Upload Smart] Using conversation ID:', conversation.id);
      
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
      await supabase
        .from('conversations')
        .update({
          audio_url: uploadedFileUrl, // Store original file path
          metadata: {
            conversation_type: 'document',
            document_translation: {
              original_filename: sanitizedFilename,
              original_storage_path: uploadedFileUrl, // Store in metadata as backup
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
      
      console.log('[Upload Smart] Stored original file path:', uploadedFileUrl);
      
      // Translation will be processed by cron job (/api/cron/process-translations)
      // Chunks are stored with empty translatedText, which marks them as pending
      console.log('[Upload Smart] Document is active. Cron job will process chunks.');
      
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
