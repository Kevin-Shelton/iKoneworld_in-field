/**
 * Skeleton Document Processor
 * 
 * This module implements the skeleton methodology for DOCX translation.
 * Based on the proven PHP approach, it preserves document formatting perfectly
 * while enabling efficient translation.
 * 
 * Core Workflow:
 * 1. STRIP - Extract text, create skeleton with markers
 * 2. TRANSLATE - Send clean text to Verbum API
 * 3. BUILD - Inject translated text back into skeleton
 */

import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

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
 * This function:
 * - Parses the Word document XML
 * - Finds all text nodes (<w:t>)
 * - Replaces text with numbered markers (e.g., §1, §2, §3)
 * - Returns clean text + skeleton for later reconstruction
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

  // Parse XML with namespace support
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  
  // Get all text nodes using XPath-like approach
  // In Word XML, all text is in <w:t> elements
  const textNodes = doc.getElementsByTagNameNS(
    'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    't'
  );

  let parsed = '';
  let counter = 1;

  // Process each text node
  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];
    const text = node.textContent || '';

    // Skip empty or whitespace-only nodes in parsed text
    // But keep them in the map to preserve structure
    if (text.trim() === '') {
      continue;
    }

    // Add text to parsed string with delimiter
    parsed += special + text;

    // Replace node content with numbered marker
    node.textContent = special + counter;
    counter++;
  }

  // Serialize the modified document back to XML string
  const map = new XMLSerializer().serializeToString(doc);

  return {
    parsed,
    map,
    special,
  };
}

/**
 * Rebuild document XML with translated text
 * 
 * This function:
 * - Splits translated text by delimiter
 * - Loads skeleton XML with markers
 * - Replaces each marker with corresponding translated segment
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

  // Parse skeleton XML
  const doc = new DOMParser().parseFromString(map, 'text/xml');
  
  // Get all text nodes
  const textNodes = doc.getElementsByTagNameNS(
    'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    't'
  );

  // Replace numbered markers with translated text
  let counter = 1;
  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];
    const value = node.textContent || '';

    // Check if this is a numbered marker (e.g., §1, §2, §3)
    if (value === special + counter) {
      // Replace with corresponding translated segment
      if (segments[counter - 1] !== undefined) {
        node.textContent = segments[counter - 1];
      }
      counter++;
    }
  }

  // Serialize back to XML string
  return new XMLSerializer().serializeToString(doc);
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
  const MB = 1024 * 1024;
  
  if (sizeInBytes < 2 * MB) {
    return 'small';  // < 2MB - Use skeleton method
  } else if (sizeInBytes < 5 * MB) {
    return 'medium'; // 2-5MB - Use skeleton method with caution
  } else {
    return 'large';  // > 5MB - Use chunking method
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
