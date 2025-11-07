/**
 * Mammoth-based Document Processor with Formatting Preservation
 * 
 * Uses the mammoth library for reliable DOCX processing
 * Workflow: DOCX → HTML (with formatting) → Translate HTML → DOCX (via TurboDocx)
 */

import mammoth from 'mammoth';
import { convertHtmlToDocx, wrapHtmlDocument } from './turbodocxConverter';

export interface TranslationResult {
  translatedBuffer: Buffer;
  originalText: string;
  translatedText: string;
}

/**
 * Extract text from DOCX for translation (plain text version)
 * Used for simple text extraction without formatting
 * 
 * @param buffer - DOCX file buffer
 * @returns Extracted plain text
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Convert DOCX to HTML with formatting preserved
 * 
 * @param buffer - DOCX file buffer
 * @returns HTML string with formatting
 */
export async function convertDocxToHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      // Preserve images as base64 data URLs
      convertImage: mammoth.images.imgElement((image) => {
        return image.read('base64').then((imageBuffer) => {
          return {
            src: `data:${image.contentType};base64,${imageBuffer}`,
          };
        });
      }),
      // Style mappings to preserve more formatting
      styleMap: [
        // Preserve heading styles
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Heading 5'] => h5:fresh",
        "p[style-name='Heading 6'] => h6:fresh",
        // Preserve list styles
        "p[style-name='List Paragraph'] => p:fresh",
        // Preserve bold and italic
        "b => strong",
        "i => em",
      ],
    }
  );
  
  if (result.messages.length > 0) {
    console.log('[Mammoth] Conversion messages:', result.messages);
  }
  
  return result.value;
}

/**
 * Extract text content from HTML tags
 */
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Translate HTML content while preserving tags and structure
 * 
 * Strategy: Extract text segments between tags, translate them, reconstruct HTML
 * 
 * @param html - HTML string with formatting
 * @param translateFn - Function that translates text
 * @returns Translated HTML with preserved structure
 */
export async function translateHtml(
  html: string,
  translateFn: (text: string) => Promise<string>
): Promise<string> {
  console.log('[Translate HTML] Starting translation, HTML length:', html.length);
  console.log('[Translate HTML] First 200 chars of HTML:', html.substring(0, 200));
  
  // Extract all text content for translation
  const textSegments: string[] = [];
  const segmentMarkers: string[] = [];
  
  // Match text content in common tags (including table cells)
  const tagPattern = /<(p|h[1-6]|li|td|th|strong|em|b|i|u|span|div)([^>]*)>(.*?)<\/\1>/gi;
  
  let modifiedHtml = html;
  let match;
  let segmentIndex = 0;
  
  // First pass: extract text segments
  const regex = new RegExp(tagPattern);
  console.log('[Translate HTML] Starting text extraction with regex');
  
  // Reset regex lastIndex
  regex.lastIndex = 0;
  
  while ((match = regex.exec(html)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1];
    const attributes = match[2];
    const content = match[3];
    
    // Skip if content is empty or only whitespace
    if (!content || !content.trim()) {
      continue;
    }
    
    // Check if content has nested tags
    if (/<[^>]+>/.test(content)) {
      // Has nested tags, extract text only
      const text = extractTextFromHtml(content);
      if (text.trim()) {
        textSegments.push(text);
        const marker = `__SEGMENT_${segmentIndex}__`;
        segmentMarkers.push(marker);
        modifiedHtml = modifiedHtml.replace(fullMatch, `<${tagName}${attributes}>${marker}</${tagName}>`);
        segmentIndex++;
      }
    } else {
      // Simple text content
      const text = content.trim();
      if (text) {
        textSegments.push(text);
        const marker = `__SEGMENT_${segmentIndex}__`;
        segmentMarkers.push(marker);
        modifiedHtml = modifiedHtml.replace(fullMatch, `<${tagName}${attributes}>${marker}</${tagName}>`);
        segmentIndex++;
      }
    }
  }
  
  console.log(`[Translate HTML] Extracted ${textSegments.length} text segments`);
  console.log('[Translate HTML] First 3 segments:', textSegments.slice(0, 3));
  
  if (textSegments.length === 0) {
    console.log('[Translate HTML] No text segments found, returning original');
    return html;
  }
  
  // Translate all segments together
  // Use a unique marker that's unlikely to be translated
  const MARKER = '\n\n###XSEGX###\n\n';
  const combinedText = textSegments.join(MARKER);
  console.log(`[Translate HTML] Translating ${textSegments.length} text segments`);
  console.log('[Translate HTML] Combined text length:', combinedText.length);
  console.log('[Translate HTML] First 200 chars of combined text:', combinedText.substring(0, 200));
  
  const translatedCombined = await translateFn(combinedText);
  console.log('[Translate HTML] Translation complete, result length:', translatedCombined.length);
  console.log('[Translate HTML] First 200 chars of translated:', translatedCombined.substring(0, 200));
  
  // Try multiple split patterns in case the marker was partially translated
  let translatedSegments: string[];
  if (translatedCombined.includes(MARKER)) {
    // Marker preserved perfectly
    translatedSegments = translatedCombined.split(MARKER);
  } else if (translatedCombined.includes('###XSEGX###')) {
    // Marker preserved without newlines
    translatedSegments = translatedCombined.split(/\s*###XSEGX###\s*/);
  } else {
    // Fallback: marker was translated or corrupted, use original segments
    console.warn('[Translate HTML] Marker not found in translation, using original segments');
    translatedSegments = textSegments;
  }
  
  console.log(`[Translate HTML] Split into ${translatedSegments.length} translated segments`);
  console.log('[Translate HTML] First 3 translated segments:', translatedSegments.slice(0, 3));
  
  // Replace markers with translated text
  let translatedHtml = modifiedHtml;
  segmentMarkers.forEach((marker, index) => {
    const translatedText = translatedSegments[index] || textSegments[index];
    translatedHtml = translatedHtml.replace(marker, translatedText);
  });
  
  console.log('[Translate HTML] Final translated HTML length:', translatedHtml.length);
  console.log('[Translate HTML] First 200 chars of result:', translatedHtml.substring(0, 200));
  
  return translatedHtml;
}

/**
 * Process DOCX translation using HTML-based workflow with TurboDocx
 * 
 * Workflow:
 * 1. DOCX → HTML (mammoth.js) - preserves images, tables, lists, formatting
 * 2. Translate HTML (preserve structure)
 * 3. HTML → DOCX (@turbodocx/html-to-docx) - comprehensive format preservation
 * 
 * @param originalBuffer - Original DOCX file
 * @param translateFn - Function that translates text (async)
 * @returns Translation result with buffers and text
 */
export async function processDocxTranslation(
  originalBuffer: Buffer,
  translateFn: (text: string) => Promise<string>
): Promise<TranslationResult> {
  console.log('[processDocxTranslation] Starting DOCX translation with HTML-based workflow');
  
  try {
    // Step 1: Convert DOCX to HTML (preserves images, tables, lists)
    console.log('[processDocxTranslation] Step 1: Converting DOCX to HTML...');
    const html = await convertDocxToHtml(originalBuffer);
    console.log('[processDocxTranslation] Converted to HTML, length:', html.length);
    
    // Extract original text for metadata
    const originalText = extractTextFromHtml(html);
    console.log('[processDocxTranslation] Extracted original text, length:', originalText.length);
    
    // Step 2: Translate HTML while preserving structure
    console.log('[processDocxTranslation] Step 2: Translating HTML...');
    const translatedHtml = await translateHtml(html, translateFn);
    console.log('[processDocxTranslation] Translated HTML, length:', translatedHtml.length);
    
    // Extract translated text for metadata
    const translatedText = extractTextFromHtml(translatedHtml);
    console.log('[processDocxTranslation] Extracted translated text, length:', translatedText.length);
    
    // Step 3: Convert HTML back to DOCX using TurboDocx
    console.log('[processDocxTranslation] Step 3: Converting HTML to DOCX with TurboDocx...');
    const wrappedHtml = wrapHtmlDocument(translatedHtml);
    const translatedBuffer = await convertHtmlToDocx(wrappedHtml, {
      title: 'Translated Document',
      creator: 'iKoneworld Translation System',
    });
    console.log('[processDocxTranslation] Created translated DOCX, size:', translatedBuffer.length);
    
    return {
      translatedBuffer,
      originalText,
      translatedText,
    };
  } catch (error) {
    console.error('[processDocxTranslation] Error with HTML-based workflow:', error);
    console.log('[processDocxTranslation] Falling back to plain-text approach');
    
    // Fallback to plain-text approach if HTML workflow fails
    const originalText = await extractTextFromDocx(originalBuffer);
    const translatedText = await translateFn(originalText);
    
    // Create simple DOCX with translated text using TurboDocx
    const simpleHtml = `<p>${translatedText.split('\n').join('</p><p>')}</p>`;
    const wrappedHtml = wrapHtmlDocument(simpleHtml);
    const translatedBuffer = await convertHtmlToDocx(wrappedHtml);
    
    return {
      translatedBuffer,
      originalText,
      translatedText,
    };
  }
}
