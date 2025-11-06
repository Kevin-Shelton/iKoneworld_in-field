import { NextRequest, NextResponse } from 'next/server';
import { stripDocument, buildDocument, getFileSizeCategory } from '@/lib/skeletonDocumentProcessor';
import { extractDocumentXml, createModifiedDocx, validateDocxStructure } from '@/lib/docxHandler';

/**
 * POST /api/documents/translate-sync
 * 
 * Synchronous document translation using skeleton methodology
 * 
 * This endpoint:
 * 1. Receives DOCX file + language parameters
 * 2. Extracts document.xml
 * 3. Strips text and creates skeleton
 * 4. Translates text via Verbum API
 * 5. Rebuilds document with translations
 * 6. Returns translated DOCX buffer
 * 
 * Suitable for small-medium files (< 5MB)
 * For larger files, use the async chunking endpoint
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sourceLanguage = formData.get('sourceLanguage') as string;
    const targetLanguage = formData.get('targetLanguage') as string;
    
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
    
    // Check file type
    if (!file.name.endsWith('.docx')) {
      return NextResponse.json(
        { error: 'Only DOCX files are supported for skeleton translation' },
        { status: 400 }
      );
    }
    
    // Check file size
    const sizeCategory = getFileSizeCategory(file.size);
    if (sizeCategory === 'large') {
      return NextResponse.json(
        { 
          error: 'File too large for synchronous processing',
          suggestion: 'Use async endpoint for files > 5MB',
          fileSize: file.size,
          maxSize: 5 * 1024 * 1024,
        },
        { status: 413 }
      );
    }
    
    console.log(`[Skeleton Translate] Starting translation: ${file.name} (${file.size} bytes)`);
    console.log(`[Skeleton Translate] ${sourceLanguage} → ${targetLanguage}`);
    
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
    console.log('[Skeleton Translate] Step 1: Extracting document.xml');
    const documentXml = await extractDocumentXml(buffer);
    
    // Step 2: Strip text and create skeleton
    console.log('[Skeleton Translate] Step 2: Stripping text and creating skeleton');
    const { parsed, map, special } = stripDocument(documentXml);
    
    console.log(`[Skeleton Translate] Extracted text length: ${parsed.length} characters`);
    console.log(`[Skeleton Translate] Using delimiter: ${special}`);
    
    // Step 3: Translate text via Verbum API
    console.log('[Skeleton Translate] Step 3: Translating text');
    
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
      console.error('[Skeleton Translate] Translation API error:', errorText);
      throw new Error(`Translation API failed: ${translateResponse.status}`);
    }
    
    const translateData = await translateResponse.json();
    
    if (!translateData.translations?.[0]?.[0]?.text) {
      console.error('[Skeleton Translate] Invalid translation response:', translateData);
      throw new Error('Invalid translation response from Verbum API');
    }
    
    const translatedText = translateData.translations[0][0].text;
    console.log(`[Skeleton Translate] Translated text length: ${translatedText.length} characters`);
    
    // Step 4: Build document with translated text
    console.log('[Skeleton Translate] Step 4: Building document with translations');
    const newDocumentXml = buildDocument(translatedText, map, special);
    
    // Step 5: Create new DOCX file
    console.log('[Skeleton Translate] Step 5: Creating new DOCX file');
    const translatedBuffer = await createModifiedDocx(buffer, newDocumentXml);
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const originalName = file.name.replace('.docx', '');
    const newFilename = `${originalName}_${sourceLanguage.toUpperCase()}_to_${targetLanguage.toUpperCase()}_${timestamp}.docx`;
    
    const processingTime = Date.now() - startTime;
    console.log(`[Skeleton Translate] ✓ Translation completed in ${processingTime}ms`);
    console.log(`[Skeleton Translate] Output file: ${newFilename} (${translatedBuffer.length} bytes)`);
    
    // Return the translated DOCX file
    return new NextResponse(translatedBuffer, {
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
    
  } catch (error) {
    console.error('[Skeleton Translate] Error:', error);
    
    return NextResponse.json(
      {
        error: 'Translation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
