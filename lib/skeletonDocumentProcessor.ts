/**
 * Skeleton Document Processor - Serverless Compatible
 * 
 * Based on the PHP methodology using pure string manipulation
 * No DOM dependencies - works in serverless environments like Vercel
 * 
 * Core Workflow:
 * 1. STRIP - Extract text from XML tags, create skeleton with markers
 * 2. TRANSLATE - Send clean text to Verbum API
 * 3. BUILD - Inject translated text back into skeleton
 */

/**
 * Special characters used as delimiters/markers
 * The system will automatically find one that's not used in the document
 */
const SPECIAL_CHARACTERS = [
  '§',  // Section sign
  '¶',  // Pilcrow (paragraph mark)
  '¤',  // Currency sign
  '☼',  // Sun
  '♦',  // Diamond
  '♫',  // Musical note
  '♪',  // Musical note (eighth)
  '✓',  // Check mark
  '✗',  // X mark
  '⚑',  // Flag
  '⚡',  // Lightning
  '⚙',  // Gear
];

/**
 * Result from stripping a document
 */
export interface StripResult {
  /** Concatenated text with special character delimiters */
  parsed: string;
  /** Skeleton XML with numbered markers replacing original text */
  map: string;
  /** The special character used as delimiter */
  special: string;
}

/**
 * Extract text from DOCX document.xml while preserving structure
 * 
 * Uses regex-based approach (like the PHP version) instead of DOM parsing
 * to avoid serverless environment issues with DOMMatrix/Canvas
 * 
 * @param xml - The content of word/document.xml from the DOCX file
 * @returns StripResult containing parsed text, skeleton map, and delimiter
 * @throws Error if no unique special character is available
 */
export function stripDocument(xml: string): StripResult {
  // Find a special character not used in the document
  const special = SPECIAL_CHARACTERS.find(char => !xml.includes(char));
  
  if (!special) {
    throw new Error('No unique special character available. Document uses all reserved markers.');
  }

  // Regular expression to match text content within <w:t> tags
  // Captures: opening tag, text content, closing tag
  const textTagRegex = /(<w:t[^>]*>)(.*?)(<\/w:t>)/g;
  
  let parsed = '';
  let counter = 1;
  let skeletonXml = xml;
  
  // Find all text nodes and process them
  const matches: Array<{ fullMatch: string; openTag: string; text: string; closeTag: string; index: number }> = [];
  
  let match;
  while ((match = textTagRegex.exec(xml)) !== null) {
    matches.push({
      fullMatch: match[0],
      openTag: match[1],
      text: match[2],
      closeTag: match[3],
      index: match.index,
    });
  }
  
  // Build parsed text in forward order (prepending reverses it)
  const textSegments: string[] = [];
  
  for (const m of matches) {
    const text = m.text;
    
    // Skip empty or whitespace-only nodes
    if (text.trim() === '') {
      continue;
    }
    
    // Add text to segments
    textSegments.push(text);
  }
  
  // Build parsed string with delimiters
  parsed = special + textSegments.join(special) + special;
  
  // Now process matches in reverse order to maintain string indices for skeleton
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const text = m.text;
    
    // Skip empty or whitespace-only nodes
    if (text.trim() === '') {
      continue;
    }
    
    // Replace text content with numbered marker in skeleton
    const marker = special + counter;
    const replacement = m.openTag + marker + m.closeTag;
    
    skeletonXml = 
      skeletonXml.substring(0, m.index) +
      replacement +
      skeletonXml.substring(m.index + m.fullMatch.length);
    
    counter++;
  }
  
  return {
    parsed,
    map: skeletonXml,
    special,
  };
}

/**
 * Rebuild document XML with translated text
 * 
 * This function:
 * - Splits translated text by delimiter
 * - Replaces numbered markers with corresponding translated segments
 * - Returns complete XML ready to be saved as document.xml
 * 
 * @param translatedText - The translated text with delimiters (e.g., "§Hola§Mundo")
 * @param map - The skeleton XML with numbered markers
 * @param special - The delimiter character used
 * @returns Complete XML with translations injected
 */
export function buildDocument(
  translatedText: string,
  map: string,
  special: string
): string {
  // Split translated text by delimiter and filter out empty strings
  const parts = translatedText.split(special);
  const segments: string[] = [];
  
  for (const part of parts) {
    if (part.trim() !== '') {
      segments.push(part);
    }
  }

  let result = map;
  
  // Replace numbered markers with translated text
  // Process in reverse order to maintain string indices
  for (let counter = segments.length; counter >= 1; counter--) {
    const marker = special + counter;
    const translation = segments[counter - 1];
    
    if (translation !== undefined) {
      // Escape XML special characters to prevent corruption
      const escapedTranslation = escapeXml(translation);
      
      // Replace all occurrences of this marker
      result = result.replace(
        new RegExp(`(<w:t[^>]*>)${escapeRegex(marker)}(<\/w:t>)`, 'g'),
        `$1${escapedTranslation}$2`
      );
    }
  }

  return result;
}

/**
 * Escape special XML characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escape special regex characters
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate that a DOCX file buffer is valid
 * 
 * @param buffer - The file buffer to validate
 * @returns true if valid DOCX structure
 */
export function isValidDocx(buffer: Buffer): boolean {
  try {
    // DOCX files are ZIP archives
    // Check for ZIP signature (PK\x03\x04)
    const signature = buffer.slice(0, 4);
    return (
      signature[0] === 0x50 && // P
      signature[1] === 0x4b && // K
      signature[2] === 0x03 &&
      signature[3] === 0x04
    );
  } catch {
    return false;
  }
}

/**
 * Get file size category for routing decision
 * 
 * @param sizeInBytes - File size in bytes
 * @returns 'small' | 'medium' | 'large'
 */
export function getFileSizeCategory(sizeInBytes: number): 'small' | 'medium' | 'large' {
  const KB = 1024;
  const MB = 1024 * 1024;
  
  // Verbum API has character limit (~50k chars)
  // A 100KB DOCX typically contains ~30-40k characters of text
  // To be safe, only use skeleton method for files under 100KB
  if (sizeInBytes < 100 * KB) {
    return 'small';  // < 100KB - Safe for skeleton method
  } else if (sizeInBytes < 200 * KB) {
    return 'medium'; // 100-200KB - May exceed API limits, use chunking
  } else {
    return 'large';  // > 200KB - Use chunking method
  }
}

/**
 * Calculate estimated processing time based on file size
 * 
 * @param sizeInBytes - File size in bytes
 * @returns Estimated time in seconds
 */
export function estimateProcessingTime(sizeInBytes: number): number {
  const MB = 1024 * 1024;
  const sizeMB = sizeInBytes / MB;
  
  // Rough estimates based on testing
  // Small files: ~2-5 seconds
  // Medium files: ~5-15 seconds
  // Large files: ~30+ seconds
  
  if (sizeMB < 1) return 3;
  if (sizeMB < 2) return 5;
  if (sizeMB < 5) return 10;
  return 30;
}
