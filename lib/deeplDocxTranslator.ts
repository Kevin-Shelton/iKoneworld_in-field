/**
 * DeepL DOCX Document Translator
 * 
 * Uses DeepL's Document Translation API to translate DOCX files while preserving
 * all formatting, images, colors, fonts, tables, and layout.
 */

import * as deepl from 'deepl-node';

/**
 * Translate a DOCX document using DeepL's Document Translation API
 * 
 * @param fileBuffer - The original DOCX file buffer
 * @param fileName - Original filename
 * @param sourceLanguage - Source language code (e.g., 'en')
 * @param targetLanguage - Target language code (e.g., 'es')
 * @returns Translated DOCX buffer
 */
export async function translateDOCXWithDeepL(
  fileBuffer: Buffer,
  fileName: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<Buffer> {
  // Validate API key
  if (!process.env.DEEPL_API_KEY) {
    throw new Error('DEEPL_API_KEY environment variable is not set');
  }

  console.log('[DeepL DOCX] Starting DOCX translation');
  console.log('[DeepL DOCX] File:', fileName);
  console.log('[DeepL DOCX] Source language:', sourceLanguage);
  console.log('[DeepL DOCX] Target language:', targetLanguage);
  console.log('[DeepL DOCX] File size:', fileBuffer.length, 'bytes');

  // Initialize DeepL translator
  const translator = new deepl.Translator(process.env.DEEPL_API_KEY);

  try {
    // Step 1: Upload document for translation
    console.log('[DeepL DOCX] Uploading document...');
    const uploadResult = await translator.uploadDocument(
      fileBuffer,
      sourceLanguage as deepl.SourceLanguageCode,
      targetLanguage as deepl.TargetLanguageCode,
      { filename: fileName }
    );

    console.log('[DeepL DOCX] Document uploaded successfully');
    console.log('[DeepL DOCX] Document ID:', uploadResult.documentId);

    // Step 2: Poll for translation completion
    console.log('[DeepL DOCX] Waiting for translation to complete...');
    let status = await translator.getDocumentStatus(uploadResult);
    
    const maxWaitTime = 300000; // 5 minutes
    const pollInterval = 2000; // 2 seconds
    const startTime = Date.now();

    while (status.status !== 'done' && (Date.now() - startTime) < maxWaitTime) {
      if (status.status === 'error') {
        throw new Error(`DeepL translation failed: ${status.errorMessage || 'Unknown error'}`);
      }

      console.log('[DeepL DOCX] Translation status:', status.status, 
        status.secondsRemaining ? `(~${status.secondsRemaining}s remaining)` : '');

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      // Check status again
      status = await translator.getDocumentStatus(uploadResult);
    }

    if (status.status !== 'done') {
      throw new Error(`DeepL translation timeout - last status: ${status.status}`);
    }

    console.log('[DeepL DOCX] Translation completed successfully');
    console.log('[DeepL DOCX] Billed characters:', status.billedCharacters);

    // Step 3: Download translated document
    console.log('[DeepL DOCX] Downloading translated document...');
    
    // DeepL requires an output file path
    // We'll use a temporary file and then read it
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `deepl_docx_${Date.now()}.docx`);
    
    await translator.downloadDocument(uploadResult, tempFile);
    
    // Read the temp file into a buffer
    const translatedBuffer = await fs.readFile(tempFile);
    console.log('[DeepL DOCX] Downloaded translated document, size:', translatedBuffer.length, 'bytes');
    
    // Clean up temp file
    try {
      await fs.unlink(tempFile);
    } catch (e) {
      console.warn('[DeepL DOCX] Failed to delete temp file:', tempFile);
    }

    return translatedBuffer;

  } catch (error) {
    console.error('[DeepL DOCX] Translation error:', error);
    
    if (error instanceof Error) {
      // Provide more helpful error messages
      if (error.message.includes('quota')) {
        throw new Error('DeepL API quota exceeded. Please check your account limits.');
      } else if (error.message.includes('unauthorized') || error.message.includes('403')) {
        throw new Error('DeepL API authentication failed. Please check your API key.');
      } else if (error.message.includes('unsupported')) {
        throw new Error('DeepL does not support this language pair or file type.');
      }
    }
    
    throw error;
  }
}

/**
 * Map language codes to DeepL format
 * DeepL uses specific codes (e.g., 'EN-US' instead of 'en')
 */
export function mapToDeepLLanguageCode(languageCode: string, isSource: boolean = false): string {
  const code = languageCode.toLowerCase();
  
  // Source language mappings
  if (isSource) {
    const sourceMap: Record<string, string> = {
      'en': 'en',
      'es': 'es',
      'fr': 'fr',
      'de': 'de',
      'it': 'it',
      'pt': 'pt',
      'ru': 'ru',
      'ja': 'ja',
      'zh': 'zh',
      'ko': 'ko',
      'nl': 'nl',
      'pl': 'pl',
      'sv': 'sv',
      'da': 'da',
      'fi': 'fi',
      'no': 'nb',
      'cs': 'cs',
      'el': 'el',
      'hu': 'hu',
      'ro': 'ro',
      'sk': 'sk',
      'tr': 'tr',
      'uk': 'uk',
      'bg': 'bg',
      'et': 'et',
      'lv': 'lv',
      'lt': 'lt',
      'sl': 'sl',
    };
    return sourceMap[code] || code;
  }
  
  // Target language mappings (some require variants)
  const targetMap: Record<string, string> = {
    'en': 'en-US', // Default to US English
    'en-us': 'en-US',
    'en-gb': 'en-GB',
    'pt': 'pt-PT', // Default to European Portuguese
    'pt-pt': 'pt-PT',
    'pt-br': 'pt-BR',
    'es': 'es',
    'fr': 'fr',
    'de': 'de',
    'it': 'it',
    'ru': 'ru',
    'ja': 'ja',
    'zh': 'zh',
    'ko': 'ko',
    'nl': 'nl',
    'pl': 'pl',
    'sv': 'sv',
    'da': 'da',
    'fi': 'fi',
    'no': 'nb',
    'cs': 'cs',
    'el': 'el',
    'hu': 'hu',
    'ro': 'ro',
    'sk': 'sk',
    'tr': 'tr',
    'uk': 'uk',
    'bg': 'bg',
    'et': 'et',
    'lv': 'lv',
    'lt': 'lt',
    'sl': 'sl',
  };
  
  return targetMap[code] || code;
}
