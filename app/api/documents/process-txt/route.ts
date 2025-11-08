import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { translateTXTWithVerbum } from '@/lib/verbumTxtTranslator';
import { uploadDocumentToSupabase } from '@/lib/supabaseStorage';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/documents/process-txt
 * 
 * Background processing endpoint for large text files
 * Uses Verbum AI API for cost-effective translation
 */
export async function POST(request: NextRequest) {
  const processingStartTime = Date.now();
  
  try {
    const { conversationId } = await request.json();
    
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }
    
    console.log(`[Process TXT] Starting background translation for conversation ${conversationId}`);
    
    // 1. Fetch conversation details from database
    const { data: conversation, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
    
    if (fetchError || !conversation) {
      console.error('[Process TXT] Failed to fetch conversation:', fetchError);
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
      console.error('[Process TXT] No original file path found in metadata');
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
    
    console.log(`[Process TXT] Downloading original text file from: ${originalStoragePath}`);
    
    // 3. Download original text file from Supabase storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(originalStoragePath);
    
    if (downloadError || !fileData) {
      console.error('[Process TXT] Failed to download original file:', downloadError);
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
    
    console.log(`[Process TXT] Translating text file with Verbum (${sourceLanguage} → ${targetLanguage})`);
    
    // 5. Translate text file with Verbum
    if (!process.env.VERBUM_API_KEY) {
      console.error('[Process TXT] Verbum API key not configured');
      await supabase.from('conversations').update({
        status: 'failed',
        metadata: {
          ...metadata,
          document_translation: {
            ...metadata?.document_translation,
            error: 'Verbum API key not configured',
          },
        },
      }).eq('id', conversationId);
      return NextResponse.json({ error: 'Verbum API key not configured' }, { status: 500 });
    }
    
    const translatedBuffer = await translateTXTWithVerbum(
      buffer,
      originalFilename || 'document.txt',
      sourceLanguage,
      targetLanguage
    );
    
    console.log(`[Process TXT] Translation completed, uploading translated text file`);
    
    // 6. Generate translated filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const originalName = (originalFilename || 'document.txt').replace('.txt', '');
    const newFilename = `${originalName}_${sourceLanguage.toUpperCase()}_to_${targetLanguage.toUpperCase()}_${timestamp}.txt`;
    
    // 7. Upload translated text file to Supabase storage
    const translatedStoragePath = await uploadDocumentToSupabase({
      fileBuffer: translatedBuffer,
      fileName: newFilename,
      contentType: 'text/plain',
      enterpriseId,
      userId,
      conversationId,
      isTranslated: true,
    });
    
    const processingDurationMs = Date.now() - processingStartTime;
    
    console.log(`[Process TXT] Translation completed in ${Math.round(processingDurationMs / 1000)}s`);
    
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
          method: 'txt-verbum',
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
    console.error('[Process TXT] Translation error:', error);
    
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
      console.error('[Process TXT] Failed to update error status:', updateError);
    }
    
    return NextResponse.json({
      error: 'Text file translation failed',
      message: (error as Error).message || 'Unknown error',
    }, { status: 500 });
  }
}
