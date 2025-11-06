import { NextRequest, NextResponse } from 'next/server';
import { getFileSizeCategory, estimateProcessingTime, stripDocument, buildDocument } from '@/lib/skeletonDocumentProcessor';
import { extractDocumentXml, createModifiedDocx, validateDocxStructure } from '@/lib/docxHandler';
import { createDocumentTranslation, storeDocumentChunks } from '@/lib/db/documents';
import { uploadDocumentToSupabase } from '@/lib/supabaseStorage';
import {
  extractTextFromDocument,
  chunkText,
  isValidFileType,
  isValidFileSize,
  sanitizeFilename,
} from '@/lib/documentProcessor';

/**
 * POST /api/documents/upload-smart
 * 
 * Smart routing upload handler
 * 
 * This endpoint analyzes the uploaded file and routes it to the appropriate
 * translation method:
 * - Small/Medium DOCX files (< 5MB) → Skeleton method (sync)
 * - Large files or non-DOCX → Chunking method (async)
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
    const useSkeletonMethod = 
      fileExtension === 'docx' && 
      (sizeCategory === 'small' || sizeCategory === 'medium');
    
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
      
      // Step 1: Extract document.xml
      console.log('[Upload Smart] Step 1: Extracting document.xml');
      const documentXml = await extractDocumentXml(buffer);
      
      // Step 2: Strip text and create skeleton
      console.log('[Upload Smart] Step 2: Stripping text and creating skeleton');
      const { parsed, map, special } = stripDocument(documentXml);
      
      console.log(`[Upload Smart] Extracted text length: ${parsed.length} characters`);
      console.log(`[Upload Smart] Using delimiter: ${special}`);
      
      // Step 3: Translate text via Verbum API
      console.log('[Upload Smart] Step 3: Translating text');
      
      const translateResponse = await fetch(
        'https://sdk.verbum.ai/v1/translator/translate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.VERBUM_API_KEY!,
          },
          body: JSON.stringify({
            texts: [{ text: parsed }],
            from: sourceLanguage,
            to: [targetLanguage],
          }),
        }
      );
      
      if (!translateResponse.ok) {
        const errorText = await translateResponse.text();
        console.error('[Upload Smart] Translation API error:', errorText);
        throw new Error(`Translation API failed: ${translateResponse.status}`);
      }
      
      const translateData = await translateResponse.json();
      
      if (!translateData.translations?.[0]?.[0]?.text) {
        console.error('[Upload Smart] Invalid translation response:', translateData);
        throw new Error('Invalid translation response from Verbum API');
      }
      
      const translatedText = translateData.translations[0][0].text;
      console.log(`[Upload Smart] Translated text length: ${translatedText.length} characters`);
      
      // Step 4: Build document with translated text
      console.log('[Upload Smart] Step 4: Building document with translations');
      const newDocumentXml = buildDocument(translatedText, map, special);
      
      // Step 5: Create new DOCX file
      console.log('[Upload Smart] Step 5: Creating new DOCX file');
      const translatedBuffer = await createModifiedDocx(buffer, newDocumentXml);
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const originalName = file.name.replace('.docx', '');
      const newFilename = `${originalName}_${sourceLanguage.toUpperCase()}_to_${targetLanguage.toUpperCase()}_${timestamp}.docx`;
      
      const processingTime = Date.now() - startTime;
      console.log(`[Upload Smart] ✓ Translation completed in ${processingTime}ms`);
      console.log(`[Upload Smart] Output file: ${newFilename} (${translatedBuffer.length} bytes)`);
      
      // Return the translated DOCX file
      return new NextResponse(new Uint8Array(translatedBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${newFilename}"`,
          'Content-Length': translatedBuffer.length.toString(),
          'X-Processing-Time': processingTime.toString(),
          'X-Translation-Method': 'skeleton',
          'X-File-Size-Category': sizeCategory,
        },
      });
      
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
      
      // Extract text from document
      console.log('[Upload Smart] Extracting text from document...');
      const extractedText = await extractTextFromDocument(fileBuffer, file.type);
      
      if (!extractedText || extractedText.trim().length === 0) {
        return NextResponse.json(
          { error: 'No text could be extracted from the document' },
          { status: 400 }
        );
      }
      
      console.log('[Upload Smart] Extracted text length:', extractedText.length);
      
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
      const uploadedFileUrl = await uploadDocumentToSupabase(
        fileBuffer,
        `${conversation.id}/${sanitizedFilename}`
      );
      
      console.log('[Upload Smart] Uploaded file to Supabase:', uploadedFileUrl);
      
      // Chunk text for translation
      const chunks = chunkText(extractedText);
      console.log('[Upload Smart] Created chunks:', chunks.length);
      
      // Store chunks in database
      await storeDocumentChunks(conversation.id, chunks);
      console.log('[Upload Smart] Stored chunks in database');
      
      // Return async processing response
      return NextResponse.json({
        success: true,
        method: 'chunking',
        conversationId: conversation.id,
        message: 'Document uploaded. Translation will begin shortly.',
        estimatedTime: `${estimatedTime} seconds`,
        status: 'queued',
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
