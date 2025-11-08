import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { translateDOCXWithDeepL } from '@/lib/deeplDocxTranslator';
import { uploadDocumentToSupabase } from '@/lib/supabaseStorage';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/documents/process-docx
 * 
 * Background processing endpoint for large DOCX files
 * Uses DeepL Document API for complete format preservation
 */
export async function POST(request: NextRequest) {
  const processingStartTime = Date.now();
  
  try {
    const { conversationId } = await request.json();
    
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }
    
    console.log(`[Process DOCX] Starting background translation for conversation ${conversationId}`);
    
    // 1. Fetch conversation details from database
    const { data: conversation, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
    
    if (fetchError || !conversation) {
      console.error('[Process DOCX] Failed to fetch conversation:', fetchError);
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    // 2. Extract metadata
    const metadata = conversation.metadata as any;
    const originalFilename = metadata?.document_translation?.original_filename;
    const originalStoragePath = metadata?.document_translation?.original_storage_path;
    const sourceLanguage = metadata?.source_language || 'en';
    const targetLanguage = metadata?.target_language || 'es';
    const enterpriseId = metadata?.enterprise_id || 'default';
    const userId = conversation.user_id;
    
    if (!originalStoragePath) {
      console.error('[Process DOCX] No original file path found in metadata');
      await supabase.from('conversations').update({
        status: 'failed',
        metadata: {
          ...metadata,
          document_translation: {
            ...metadata?.document_translation,
            error: 'Original file path not found in metadata',
          },
        },
      }).eq('id', conversationId);
      return NextResponse.json({ error: 'Original file not found' }, { status: 404 });
    }
    
    console.log(`[Process DOCX] Downloading original DOCX from: ${originalStoragePath}`);
    
    // 3. Download original DOCX from Supabase storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(originalStoragePath);
    
    if (downloadError || !fileData) {
      console.error('[Process DOCX] Failed to download original file:', downloadError);
      await supabase.from('conversations').update({
        status: 'failed',
        metadata: {
          ...metadata,
          document_translation: {
            ...metadata?.document_translation,
            error: 'Failed to download original file from storage',
          },
        },
      }).eq('id', conversationId);
      return NextResponse.json({ error: 'Failed to download original file' }, { status: 500 });
    }
    
    // 4. Convert Blob to Buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`[Process DOCX] Translating DOCX with DeepL (${sourceLanguage} → ${targetLanguage})`);
    
    // 5. Translate DOCX with DeepL
    if (!process.env.DEEPL_API_KEY) {
      console.error('[Process DOCX] DeepL API key not configured');
      await supabase.from('conversations').update({
        status: 'failed',
        metadata: {
          ...metadata,
          document_translation: {
            ...metadata?.document_translation,
            error: 'DeepL API key not configured',
          },
        },
      }).eq('id', conversationId);
      return NextResponse.json({ error: 'DeepL API key not configured' }, { status: 500 });
    }
    
    const translatedBuffer = await translateDOCXWithDeepL(
      buffer,
      originalFilename || 'document.docx',
      sourceLanguage,
      targetLanguage
    );
    
    console.log(`[Process DOCX] Translation completed, uploading translated DOCX`);
    
    // 6. Generate translated filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const originalName = (originalFilename || 'document.docx').replace('.docx', '');
    const newFilename = `${originalName}_${sourceLanguage.toUpperCase()}_to_${targetLanguage.toUpperCase()}_${timestamp}.docx`;
    
    // 7. Upload translated DOCX to Supabase storage
    const translatedStoragePath = await uploadDocumentToSupabase({
      fileBuffer: translatedBuffer,
      fileName: newFilename,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      enterpriseId,
      userId,
      conversationId,
      isTranslated: true,
    });
    
    const processingDurationMs = Date.now() - processingStartTime;
    
    console.log(`[Process DOCX] Translation completed in ${Math.round(processingDurationMs / 1000)}s`);
    
    // 8. Update database with completed status
    await supabase.from('conversations').update({
      status: 'completed',
      audio_url: translatedStoragePath,
      metadata: {
        ...metadata,
        document_translation: {
          ...metadata?.document_translation,
          translated_filename: newFilename,
          translated_file_size_bytes: translatedBuffer.length,
          translated_storage_path: translatedStoragePath,
          progress_percentage: 100,
          processing_duration_ms: processingDurationMs,
          processing_duration_seconds: Math.round(processingDurationMs / 1000),
          method: 'docx-deepl',
        },
      },
    }).eq('id', conversationId);
    
    return NextResponse.json({
      success: true,
      conversationId,
      filename: newFilename,
      status: 'completed',
    });
    
  } catch (error) {
    console.error('[Process DOCX] Translation error:', error);
    
    // Try to update database with failed status
    try {
      const { conversationId } = await request.json();
      if (conversationId) {
        await supabase.from('conversations').update({
          status: 'failed',
          metadata: {
            document_translation: {
              error: (error as Error).message || 'Unknown error',
            },
          },
        }).eq('id', conversationId);
      }
    } catch (updateError) {
      console.error('[Process DOCX] Failed to update error status:', updateError);
    }
    
    return NextResponse.json({
      error: 'DOCX translation failed',
      message: (error as Error).message || 'Unknown error',
    }, { status: 500 });
  }
}
