/**
 * Verbum Text File Translator
 * 
 * Uses Verbum AI API to translate .txt files.
 * Since text files have no formatting to preserve, we can use the more
 * cost-effective Verbum API instead of DeepL's Document API.
 */

/**
 * Translate a text file using Verbum AI API
 * 
 * @param fileBuffer - The original text file buffer
 * @param fileName - Original filename
 * @param sourceLanguage - Source language code (e.g., 'en')
 * @param targetLanguage - Target language code (e.g., 'es')
 * @returns Translated text file buffer
 */
export async function translateTXTWithVerbum(
  fileBuffer: Buffer,
  fileName: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<Buffer> {
  // Validate API key
  if (!process.env.VERBUM_API_KEY) {
    throw new Error('VERBUM_API_KEY environment variable is not set');
  }

  console.log('[Verbum TXT] Starting text file translation');
  console.log('[Verbum TXT] File:', fileName);
  console.log('[Verbum TXT] Source language:', sourceLanguage);
  console.log('[Verbum TXT] Target language:', targetLanguage);
  console.log('[Verbum TXT] File size:', fileBuffer.length, 'bytes');

  try {
    // Convert buffer to text
    const originalText = fileBuffer.toString('utf-8');
    console.log('[Verbum TXT] Text length:', originalText.length, 'characters');

    // Map language codes to Verbum format
    const mappedFrom = mapToVerbumLanguageCode(sourceLanguage);
    const mappedTo = mapToVerbumLanguageCode(targetLanguage);

    console.log('[Verbum TXT] Translating:', mappedFrom, '->', mappedTo);

    // Call Verbum API
    const response = await fetch(
      'https://sdk.verbum.ai/v1/translator/translate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.VERBUM_API_KEY,
        },
        body: JSON.stringify({
          texts: [{ text: originalText }],
          from: mappedFrom,
          to: [mappedTo],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Verbum API failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const translatedText = data.translations[0][0].text;

    console.log('[Verbum TXT] Translation completed');
    console.log('[Verbum TXT] Translated length:', translatedText.length, 'characters');

    // Convert translated text back to buffer
    const translatedBuffer = Buffer.from(translatedText, 'utf-8');

    return translatedBuffer;

  } catch (error) {
    console.error('[Verbum TXT] Translation error:', error);
    
    if (error instanceof Error) {
      // Provide more helpful error messages
      if (error.message.includes('quota') || error.message.includes('429')) {
        throw new Error('Verbum API quota exceeded. Please check your account limits.');
      } else if (error.message.includes('unauthorized') || error.message.includes('403') || error.message.includes('401')) {
        throw new Error('Verbum API authentication failed. Please check your API key.');
      } else if (error.message.includes('unsupported')) {
        throw new Error('Verbum does not support this language pair.');
      }
    }
    
    throw error;
  }
}

/**
 * Map language codes to Verbum format
 */
export function mapToVerbumLanguageCode(code: string): string {
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
  
  // Return first part of language code (e.g., 'en' from 'en-US')
  return code.split('-')[0].toLowerCase();
}
