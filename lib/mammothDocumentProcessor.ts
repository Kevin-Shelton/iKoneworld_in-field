/**
 * Mammoth-based Document Processor with Formatting Preservation
 * 
 * Uses the mammoth library for reliable DOCX processing
 * Workflow: DOCX → HTML (with formatting) → Translate HTML → DOCX
 */

import mammoth from 'mammoth';
// Note: docx library imports moved to dynamic imports to avoid DOMMatrix errors in serverless

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
  
  // Match text content in common tags
  const tagPattern = /<(p|h[1-6]|li|td|th|strong|em|b|i|u|span)([^>]*)>(.*?)<\/\1>/gi;
  
  let modifiedHtml = html;
  let match;
  let segmentIndex = 0;
  
  // First pass: extract text segments
  const regex = new RegExp(tagPattern);
  console.log('[Translate HTML] Starting text extraction with regex:', tagPattern);
  while ((match = regex.exec(html)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1];
    const attributes = match[2];
    const content = match[3];
    
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
  const combinedText = textSegments.join('\n\n---SEGMENT---\n\n');
  console.log(`[Translate HTML] Translating ${textSegments.length} text segments`);
  console.log('[Translate HTML] Combined text length:', combinedText.length);
  console.log('[Translate HTML] First 200 chars of combined text:', combinedText.substring(0, 200));
  
  const translatedCombined = await translateFn(combinedText);
  console.log('[Translate HTML] Translation complete, result length:', translatedCombined.length);
  console.log('[Translate HTML] First 200 chars of translated:', translatedCombined.substring(0, 200));
  
  const translatedSegments = translatedCombined.split(/\n\n---SEGMENT---\n\n/);
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
 * Parse HTML element and extract formatting info
 */
interface ParsedElement {
  text: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  heading?: string; // Heading level (e.g., 'HEADING_1', 'HEADING_2', etc.)
}

function parseHtmlElement(html: string): ParsedElement {
  const text = extractTextFromHtml(html);
  
  return {
    text,
    isBold: /<(strong|b)[\s>]/.test(html),
    isItalic: /<(em|i)[\s>]/.test(html),
    isUnderline: /<u[\s>]/.test(html),
    heading: html.match(/<h1[\s>]/) ? 'HEADING_1' :
             html.match(/<h2[\s>]/) ? 'HEADING_2' :
             html.match(/<h3[\s>]/) ? 'HEADING_3' :
             html.match(/<h4[\s>]/) ? 'HEADING_4' :
             html.match(/<h5[\s>]/) ? 'HEADING_5' :
             html.match(/<h6[\s>]/) ? 'HEADING_6' :
             undefined,
  };
}

/**
 * Convert HTML back to DOCX with basic formatting
 * DEPRECATED: Use htmlToDocxConverter.ts instead (dynamic import to avoid DOMMatrix)
 * Keeping this for reference but should not be used
 */
async function convertHtmlToDocx_DEPRECATED(html: string): Promise<Buffer> {
  // Dynamic import to avoid loading docx library at module level
  // This prevents DOMMatrix errors in serverless environments
  const { Document, Paragraph, TextRun, Packer, AlignmentType, HeadingLevel } = await import('docx');
  
  const paragraphs: any[] = [];
  
  // Split by paragraph and heading tags
  const elements = html.match(/<(p|h[1-6]|li)[^>]*>.*?<\/\1>/gi) || [];
  
  for (const element of elements) {
    const parsed = parseHtmlElement(element);
    
    if (!parsed.text.trim()) continue;
    
    const textRun = new TextRun({
      text: parsed.text,
      bold: parsed.isBold,
      italics: parsed.isItalic,
      underline: parsed.isUnderline ? {} : undefined,
    });
    
    // Map string heading to HeadingLevel enum
    const headingLevel = parsed.heading ? (HeadingLevel as any)[parsed.heading] : undefined;
    
    paragraphs.push(
      new Paragraph({
        children: [textRun],
        heading: headingLevel,
      })
    );
  }
  
  // Handle images - extract base64 data
  const imageMatches = html.matchAll(/<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"/gi);
  for (const match of imageMatches) {
    const mimeType = match[1];
    const base64Data = match[2];
    
    try {
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Note: Image support requires proper type configuration
      // For now, add placeholder text
      paragraphs.push(
        new Paragraph({
          children: [new TextRun('[Image: embedded content]')],
        })
      );
    } catch (error) {
      console.error('[Convert HTML] Error processing image:', error);
      // Add placeholder if image fails
      paragraphs.push(
        new Paragraph({
          children: [new TextRun('[Image]')],
        })
      );
    }
  }
  
  // Fallback: if no paragraphs found, create from plain text
  if (paragraphs.length === 0) {
    const plainText = extractTextFromHtml(html);
    const lines = plainText.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(line)],
        })
      );
    }
  }
  
  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });
  
  return await Packer.toBuffer(doc);
}

/**
 * Create a new DOCX file with translated text
 * Uses dynamic import to avoid DOMMatrix errors
 * 
 * @param originalBuffer - Original DOCX buffer (not used, kept for API compatibility)
 * @param translatedText - Translated text to put in new DOCX
 * @returns Buffer containing new DOCX file
 */
export async function createTranslatedDocx(
  originalBuffer: Buffer,
  translatedText: string
): Promise<Buffer> {
  // Dynamic import to avoid DOMMatrix errors
  const { Document, Paragraph, TextRun, Packer } = await import('docx');
  
  // Split translated text into paragraphs
  const paragraphs = translatedText
    .split('\n')
    .filter(p => p.trim() !== '')
    .map(text => 
      new Paragraph({
        children: [new TextRun(text)],
      })
    );
  
  // Create new document with translated paragraphs
  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  });
  
  // Generate DOCX buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

/**
 * Process DOCX translation (simple plain-text approach)
 * This is the working version from 24b7fc2
 * 
 * @param originalBuffer - Original DOCX file
 * @param translateFn - Function that translates text (async)
 * @returns Translation result with buffers and text
 */
export async function processDocxTranslation(
  originalBuffer: Buffer,
  translateFn: (text: string) => Promise<string>
): Promise<TranslationResult> {
  console.log('[processDocxTranslation] Starting DOCX translation with formatting preservation');
  
  try {
    // Import paragraph-level processor
    const { parseDocxStructure, translateDocxStructure, rebuildDocx } = await import('./docxFormattingProcessor');
    
    // Parse DOCX structure
    console.log('[processDocxTranslation] Parsing DOCX structure...');
    const structure = await parseDocxStructure(originalBuffer);
    console.log('[processDocxTranslation] Parsed', structure.paragraphs.length, 'paragraphs');
    
    // Extract original text for metadata
    const originalText = structure.paragraphs
      .map(p => p.runs.map(r => r.text).join(''))
      .join('\n');
    
    // Translate while preserving structure
    console.log('[processDocxTranslation] Translating paragraphs...');
    const translatedStructure = await translateDocxStructure(structure, translateFn);
    
    // Extract translated text for metadata
    const translatedText = translatedStructure.paragraphs
      .map(p => p.runs.map(r => r.text).join(''))
      .join('\n');
    
    // Rebuild DOCX with formatting
    console.log('[processDocxTranslation] Rebuilding DOCX with formatting...');
    const translatedBuffer = await rebuildDocx(translatedStructure);
    console.log('[processDocxTranslation] Created translated DOCX, size:', translatedBuffer.length);
    
    return {
      translatedBuffer,
      originalText,
      translatedText,
    };
  } catch (error) {
    console.error('[processDocxTranslation] Error with formatting preservation:', error);
    console.log('[processDocxTranslation] Falling back to plain-text approach');
    
    // Fallback to plain-text approach if formatting preservation fails
    const originalText = await extractTextFromDocx(originalBuffer);
    const translatedText = await translateFn(originalText);
    const translatedBuffer = await createTranslatedDocx(originalBuffer, translatedText);
    
    return {
      translatedBuffer,
      originalText,
      translatedText,
    };
  }
}
