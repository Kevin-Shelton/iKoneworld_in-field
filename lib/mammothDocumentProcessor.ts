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
  
  if (textSegments.length === 0) {
    console.log('[Translate HTML] No text segments found, returning original');
    return html;
  }
  
  // Translate all segments together
  const combinedText = textSegments.join('\n\n---SEGMENT---\n\n');
  console.log(`[Translate HTML] Translating ${textSegments.length} text segments`);
  
  const translatedCombined = await translateFn(combinedText);
  const translatedSegments = translatedCombined.split(/\n\n---SEGMENT---\n\n/);
  
  // Replace markers with translated text
  let translatedHtml = modifiedHtml;
  segmentMarkers.forEach((marker, index) => {
    const translatedText = translatedSegments[index] || textSegments[index];
    translatedHtml = translatedHtml.replace(marker, translatedText);
  });
  
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
  heading?: typeof HeadingLevel[keyof typeof HeadingLevel];
}

function parseHtmlElement(html: string): ParsedElement {
  const text = extractTextFromHtml(html);
  
  return {
    text,
    isBold: /<(strong|b)[\s>]/.test(html),
    isItalic: /<(em|i)[\s>]/.test(html),
    isUnderline: /<u[\s>]/.test(html),
    heading: html.match(/<h1[\s>]/) ? HeadingLevel.HEADING_1 :
             html.match(/<h2[\s>]/) ? HeadingLevel.HEADING_2 :
             html.match(/<h3[\s>]/) ? HeadingLevel.HEADING_3 :
             html.match(/<h4[\s>]/) ? HeadingLevel.HEADING_4 :
             html.match(/<h5[\s>]/) ? HeadingLevel.HEADING_5 :
             html.match(/<h6[\s>]/) ? HeadingLevel.HEADING_6 :
             undefined,
  };
}

/**
 * Convert HTML back to DOCX with basic formatting
 * 
 * @param html - HTML string
 * @returns DOCX buffer
 */
export async function convertHtmlToDocx(html: string): Promise<Buffer> {
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
    
    paragraphs.push(
      new Paragraph({
        children: [textRun],
        heading: parsed.heading,
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
 * Process DOCX translation with formatting preservation
 * 
 * @param originalBuffer - Original DOCX file
 * @param translateFn - Function that translates text (async)
 * @returns Translation result with buffers and text
 */
export async function processDocxTranslation(
  originalBuffer: Buffer,
  translateFn: (text: string) => Promise<string>
): Promise<TranslationResult> {
  console.log('[Mammoth] Starting DOCX translation with formatting preservation');
  
  // Step 1: Convert DOCX to HTML
  const originalHtml = await convertDocxToHtml(originalBuffer);
  console.log('[Mammoth] Converted to HTML, length:', originalHtml.length);
  
  // Extract plain text for reference
  const originalText = await extractTextFromDocx(originalBuffer);
  
  // Step 2: Translate HTML while preserving structure
  const translatedHtml = await translateHtml(originalHtml, translateFn);
  console.log('[Mammoth] Translated HTML, length:', translatedHtml.length);
  
  // Step 3: Convert translated HTML back to DOCX
  const translatedBuffer = await convertHtmlToDocx(translatedHtml);
  console.log('[Mammoth] Converted back to DOCX, size:', translatedBuffer.length);
  
  // Extract translated text for reference
  const translatedText = extractTextFromHtml(translatedHtml);
  
  return {
    translatedBuffer,
    originalText,
    translatedText,
  };
}
