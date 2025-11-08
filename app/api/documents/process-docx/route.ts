import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/documents/process-docx
 * 
 * Background processing endpoint for large DOCX files
 * Uses skeleton method for complete format preservation
 */
export async function POST(request: NextRequest) {
  try {
    const { conversationId } = await request.json();
    
    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }
    
    console.log('[Process DOCX] Starting background translation for conversation', conversationId);
    
    // Import dependencies
    const { supabaseAdmin } = await import('@/lib/supabase/server');
    const supabase = supabaseAdmin;
    
    // Get conversation details
    const { data: document, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
    
    if (fetchError || !document) {
      console.error('[Process DOCX] Failed to fetch conversation:', fetchError);
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }
    
    // Get original file path from metadata
    const originalStoragePath = document.metadata?.document_translation?.original_storage_path;
    
    if (!originalStoragePath) {
      console.error('[Process DOCX] No original file path found in conversation');
      return NextResponse.json(
        { error: 'Original file path not found' },
        { status: 400 }
      );
    }
    
    console.log('[Process DOCX] Downloading original DOCX from:', originalStoragePath);
    
    // Download original DOCX from storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('documents')
      .download(originalStoragePath);
    
    if (downloadError || !fileData) {
      console.error('[Process DOCX] Failed to download original file:', downloadError);
      await supabase
        .from('conversations')
        .update({ status: 'failed' })
        .eq('id', conversationId);
      
      return NextResponse.json(
        { error: 'Failed to download original file' },
        { status: 500 }
      );
    }
    
    const originalFileBuffer = Buffer.from(await fileData.arrayBuffer());
    console.log('[Process DOCX] Original DOCX downloaded, size:', originalFileBuffer.length, 'bytes');
    
    // Get language settings
    const sourceLanguage = document.language1 || 'en';
    const targetLanguage = document.language2 || 'es';
    const originalFilename = document.metadata?.document_translation?.original_filename || 'document.docx';
    
    console.log('[Process DOCX] Translating with skeleton method:', sourceLanguage, '->', targetLanguage);
    
    // Import skeleton translation functions
    const { stripDocument, buildDocument } = await import('@/lib/skeletonDocumentProcessor');
    const { extractDocumentXml, createModifiedDocx } = await import('@/lib/docxHandler');
    
    // Step 1: Extract XML structure
    console.log('[Process DOCX] Step 1: Extracting XML structure');
    const documentXml = await extractDocumentXml(originalFileBuffer);
    
    // Step 2: Strip text from structure
    console.log('[Process DOCX] Step 2: Stripping text from structure');
    const stripResult = stripDocument(documentXml);
    const skeleton = stripResult.map; // The skeleton XML with markers
    const texts = stripResult.parsed; // The concatenated text
    console.log('[Process DOCX] Extracted text length:', texts.length, 'characters');
    
    // Step 3: Translate text using Verbum API
    console.log('[Process DOCX] Step 3: Translating text');
    const verbumApiKey = process.env.VERBUM_API_KEY;
    
    if (!verbumApiKey) {
      throw new Error('VERBUM_API_KEY not configured');
    }
    
    // Map language codes to Verbum format
    const mapToVerbumLanguageCode = (code: string): string => {
      const specialCases: Record<string, string> = {
        'zh-CN': 'zh-Hans',
        'zh-TW': 'zh-Hant',
        'zh-HK': 'zh-Hant',
        'pt-PT': 'pt-pt',
        'fr-CA': 'fr-ca',
        'mn-MN': 'mn-Cyrl',
        'sr-RS': 'sr-Cyrl',
        'iu-CA': 'iu',
      };
      
      if (specialCases[code]) {
        return specialCases[code];
      }
      
      return code.split('-')[0].toLowerCase();
    };
    
    const mappedFrom = mapToVerbumLanguageCode(sourceLanguage);
    const mappedTo = mapToVerbumLanguageCode(targetLanguage);
    
    const translationResponse = await fetch(
      'https://sdk.verbum.ai/v1/translator/translate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': verbumApiKey,
        },
        body: JSON.stringify({
          texts: [{ text: texts }], // Send combined text as single item
          from: mappedFrom,
          to: [mappedTo],
        }),
      }
    );
    
    if (!translationResponse.ok) {
      const errorText = await translationResponse.text();
      throw new Error(`Verbum API failed: ${errorText}`);
    }
    
    const translationData = await translationResponse.json();
    const translatedTexts = translationData.translations[0].map((t: { text: string }) => t.text);
    const translatedText = translatedTexts[0]; // Single combined translation
    
    console.log('[Process DOCX] Translation complete, received', translatedTexts.length, 'translations');
    
    // Step 4: Build translated document
    console.log('[Process DOCX] Step 4: Building translated document');
    const translatedXml = buildDocument(skeleton, translatedText, texts);
    
    // Step 5: Create translated DOCX
    console.log('[Process DOCX] Step 5: Creating translated DOCX');
    const translatedBuffer = await createModifiedDocx(originalFileBuffer, translatedXml);
    
    console.log('[Process DOCX] Translated DOCX created, size:', translatedBuffer.length, 'bytes');
    
    // Step 6: Upload translated DOCX to storage
    console.log('[Process DOCX] Step 6: Uploading translated DOCX');
    const { uploadDocumentToSupabase } = await import('@/lib/supabaseStorage');
    
    const translatedFilename = originalFilename.replace(/\.docx$/i, '_translated.docx');
    
    const translatedStoragePath = await uploadDocumentToSupabase({
      fileBuffer: translatedBuffer,
      fileName: translatedFilename,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      enterpriseId: document.enterprise_id || 'default',
      userId: document.userId,
      conversationId: conversationId,
      isTranslated: true,
    });
    
    console.log('[Process DOCX] Uploaded translated DOCX to:', translatedStoragePath);
    
    // Step 7: Update database with completion
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        status: 'completed',
        audio_url: translatedStoragePath,
        metadata: {
          conversation_type: 'document',
          document_translation: {
            ...document.metadata?.document_translation,
            translated_filename: translatedFilename,
            translated_storage_path: translatedStoragePath,
            translated_file_url: translatedStoragePath,
            translated_file_size_bytes: translatedBuffer.length,
            progress_percentage: 100,
            completed_at: new Date().toISOString(),
          },
        },
      })
      .eq('id', conversationId);
    
    if (updateError) {
      console.error('[Process DOCX] Failed to update conversation:', updateError);
      throw new Error(`Failed to update conversation: ${updateError.message}`);
    }
    
    console.log('[Process DOCX] Translation completed successfully');
    
    return NextResponse.json({
      success: true,
      conversationId,
      translatedStoragePath,
    });
    
  } catch (error) {
    console.error('[Process DOCX] Error:', error);
    
    // Try to update conversation status to failed
    try {
      const { conversationId } = await request.json();
      if (conversationId) {
        const { supabaseAdmin } = await import('@/lib/supabase/server');
        await supabaseAdmin
          .from('conversations')
          .update({ 
            status: 'failed',
            metadata: {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          })
          .eq('id', conversationId);
      }
    } catch (updateError) {
      console.error('[Process DOCX] Failed to update error status:', updateError);
    }
    
    return NextResponse.json(
      { 
        error: 'Translation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
