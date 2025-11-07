/**
 * DOCX Structure Preserver
 * 
 * Translates DOCX documents while preserving ALL elements:
 * - Images (logos, diagrams)
 * - Headers and footers
 * - Paragraph spacing
 * - All formatting
 * 
 * Strategy: Modify the original DOCX ZIP structure directly,
 * only replacing text nodes while keeping everything else intact.
 */

export interface TranslationResult {
  translatedBuffer: Buffer;
  originalText: string;
  translatedText: string;
}

/**
 * Check if a text segment is a date or number that should not be translated
 */
function isDateOrNumber(text: string): boolean {
  const trimmed = text.trim();
  
  // Check for date patterns: MM/DD/YYYY, DD/MM/YYYY, M/D/YYYY, etc.
  const datePatterns = [
    /^\d{1,2}\/\d{1,2}\/\d{4}$/,  // 11/7/2025, 7/30/2025
    /^\d{1,2}-\d{1,2}-\d{4}$/,     // 11-7-2025
    /^\d{4}-\d{1,2}-\d{1,2}$/,     // 2025-11-07
    /^\d{1,2}\.\d{1,2}\.\d{4}$/,  // 11.7.2025
  ];
  
  for (const pattern of datePatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  // Check if it's only numbers, slashes, dashes, or dots
  if (/^[\d\/\-\.\s]+$/.test(trimmed)) {
    return true;
  }
  
  return false;
}

/**
 * Extract text nodes from XML for translation
 */
function extractTextNodes(xmlString: string): string[] {
  const textNodes: string[] = [];
  
  // Match text content in <w:t> tags
  const textRegex = /<w:t[^>]*>(.*?)<\/w:t>/g;
  let match;
  
  while ((match = textRegex.exec(xmlString)) !== null) {
    const text = match[1];
    // Decode XML entities
    const decodedText = text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    
    if (decodedText.trim()) {
      textNodes.push(decodedText);
    }
  }
  
  return textNodes;
}

/**
 * Replace text nodes in XML with translated versions
 */
function replaceTextNodes(xmlString: string, translatedTexts: string[]): string {
  let modifiedXml = xmlString;
  let textIndex = 0;
  
  // Replace each <w:t> content with translated text
  modifiedXml = modifiedXml.replace(/<w:t([^>]*)>(.*?)<\/w:t>/g, (match, attributes, originalText) => {
    // Decode original text
    const decodedOriginal = originalText
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    
    // If original was empty or whitespace, keep it
    if (!decodedOriginal.trim()) {
      return match;
    }
    
    // Get translated text
    const translatedText = translatedTexts[textIndex] || decodedOriginal;
    textIndex++;
    
    // Encode for XML
    const encodedTranslated = translatedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    
    return `<w:t${attributes}>${encodedTranslated}</w:t>`;
  });
  
  return modifiedXml;
}

/**
 * Process and translate a DOCX file while preserving ALL structure
 * 
 * @param originalBuffer - Original DOCX file buffer
 * @param translateFn - Function that translates text
 * @returns Translation result with buffers and text
 */
export async function processDocxWithStructurePreservation(
  originalBuffer: Buffer,
  translateFn: (text: string) => Promise<string>
): Promise<TranslationResult> {
  console.log('[Structure Preserver] Starting DOCX translation with full structure preservation');
  
  // Dynamic imports to avoid module-level issues
  const JSZip = (await import('jszip')).default;
  
  try {
    // Load DOCX as ZIP
    const zip = await JSZip.loadAsync(originalBuffer);
    console.log('[Structure Preserver] Loaded DOCX ZIP, files:', Object.keys(zip.files).length);
    
    // Files to process for translation
    const filesToTranslate = [
      'word/document.xml',      // Main document
      'word/header1.xml',       // Header (if exists)
      'word/header2.xml',       // Header 2 (if exists)
      'word/footer1.xml',       // Footer (if exists)
      'word/footer2.xml',       // Footer 2 (if exists)
      'word/endnotes.xml',      // Endnotes (if exists)
      'word/footnotes.xml',     // Footnotes (if exists)
    ];
    
    // Collect all text for translation
    const allTextSegments: string[] = [];
    const fileTextCounts: { [filename: string]: number } = {};
    
    for (const filename of filesToTranslate) {
      const file = zip.file(filename);
      if (!file) {
        console.log(`[Structure Preserver] Skipping ${filename} (not found)`);
        continue;
      }
      
      const xmlContent = await file.async('string');
      const textNodes = extractTextNodes(xmlContent);
      
      console.log(`[Structure Preserver] Extracted ${textNodes.length} text nodes from ${filename}`);
      fileTextCounts[filename] = textNodes.length;
      allTextSegments.push(...textNodes);
    }
    
    console.log(`[Structure Preserver] Total text segments to translate: ${allTextSegments.length}`);
    
    // Store original text
    const originalText = allTextSegments.join('\n');
    
    // Translate each segment individually to avoid separator translation issues
    console.log(`[Structure Preserver] Translating ${allTextSegments.length} segments individually...`);
    
    const translatedSegments: string[] = [];
    for (let i = 0; i < allTextSegments.length; i++) {
      const segment = allTextSegments[i];
      if (segment.trim()) {
        try {
          // Check if segment is a date or number - skip translation
          if (isDateOrNumber(segment)) {
            console.log(`[Structure Preserver] Skipping translation for date/number: "${segment}"`);
            translatedSegments.push(segment);
            continue;
          }
          
          const translated = await translateFn(segment);
          translatedSegments.push(translated);
          
          // Log progress every 10 segments
          if ((i + 1) % 10 === 0) {
            console.log(`[Structure Preserver] Translated ${i + 1}/${allTextSegments.length} segments`);
          }
        } catch (error) {
          console.error(`[Structure Preserver] Error translating segment ${i}:`, error);
          // Fallback to original text if translation fails
          translatedSegments.push(segment);
        }
      } else {
        translatedSegments.push(segment);
      }
    }
    
    console.log(`[Structure Preserver] Translation complete, got ${translatedSegments.length} segments`);
    
    // Store translated text
    const translatedText = translatedSegments.join('\n');
    
    // Replace text in each file
    let segmentIndex = 0;
    
    for (const filename of filesToTranslate) {
      const file = zip.file(filename);
      if (!file) continue;
      
      const xmlContent = await file.async('string');
      const textCount = fileTextCounts[filename];
      
      // Get translated segments for this file
      const fileTranslatedSegments = translatedSegments.slice(segmentIndex, segmentIndex + textCount);
      segmentIndex += textCount;
      
      // Replace text nodes
      const modifiedXml = replaceTextNodes(xmlContent, fileTranslatedSegments);
      
      // Update file in ZIP
      zip.file(filename, modifiedXml);
      console.log(`[Structure Preserver] Updated ${filename} with ${fileTranslatedSegments.length} translated segments`);
    }
    
    // Generate new DOCX buffer
    const translatedBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });
    
    console.log('[Structure Preserver] Generated translated DOCX, size:', translatedBuffer.length);
    
    return {
      translatedBuffer,
      originalText,
      translatedText,
    };
    
  } catch (error) {
    console.error('[Structure Preserver] Error:', error);
    throw new Error(`Failed to preserve DOCX structure: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
