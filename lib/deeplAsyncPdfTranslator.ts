import * as deepl from 'deepl-node';
import { supabaseAdmin } from '@/lib/supabase/server';
import { uploadDocumentToSupabase } from '@/lib/supabaseStorage';

export async function processDeeplPdfTranslation(conversationId: number, fileBuffer: Buffer, fileName: string, sourceLanguage: string, targetLanguage: string, enterpriseId: string, userId: number) {
  const translator = new deepl.Translator(process.env.DEEPL_API_KEY!)

  try {
    const uploadResult = await translator.uploadDocument(
      fileBuffer,
      sourceLanguage as deepl.SourceLanguageCode,
      targetLanguage as deepl.TargetLanguageCode,
      { filename: fileName }
    );

    let status = await translator.getDocumentStatus(uploadResult);
    const maxWaitTime = 300000;
    const pollInterval = 2000;
    const startTime = Date.now();

    while (status.status !== 'done' && (Date.now() - startTime) < maxWaitTime) {
      if (status.status === 'error') {
        throw new Error(`DeepL translation failed: ${status.errorMessage || 'Unknown error'}`);
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      status = await translator.getDocumentStatus(uploadResult);
    }

    if (status.status !== 'done') {
      throw new Error(`DeepL translation timeout - last status: ${status.status}`);
    }

    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `deepl_${Date.now()}.pdf`);
    await translator.downloadDocument(uploadResult, tempFile);

    const translatedBuffer = await fs.readFile(tempFile);
    await fs.unlink(tempFile);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const originalName = fileName.replace('.pdf', '');
    const newFilename = `${originalName}_${sourceLanguage.toUpperCase()}_to_${targetLanguage.toUpperCase()}_${timestamp}.pdf`;

    const translatedStoragePath = await uploadDocumentToSupabase({
      fileBuffer: translatedBuffer,
      fileName: newFilename,
      contentType: 'application/pdf',
      enterpriseId: enterpriseId || 'default',
      userId: userId,
      conversationId: conversationId,
      isTranslated: true,
    });

    await supabaseAdmin.from('conversations').update({
      status: 'completed',
      audio_url: translatedStoragePath,
      metadata: {
        // ... (metadata update)
      },
    }).eq('id', conversationId);

  } catch (error) {
    console.error('[DeepL Async] Translation error:', error);
    await supabaseAdmin.from('conversations').update({
      status: 'failed',
      metadata: {
        // ... (error metadata update)
      },
    }).eq('id', conversationId);
  }
}
