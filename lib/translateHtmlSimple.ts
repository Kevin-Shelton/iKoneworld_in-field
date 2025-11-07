/**
 * Simple HTML Translation - Preserves Structure
 * 
 * This approach extracts all text nodes from HTML, translates them together,
 * then replaces them back. This preserves the HTML structure perfectly.
 */

/**
 * Extract text content from HTML while preserving structure
 * Returns array of text segments and their positions
 */
function extractTextSegments(html: string): { segments: string[], markers: string[] } {
  const segments: string[] = [];
  const markers: string[] = [];
  let markerIndex = 0;
  
  // Replace text content with unique markers
  let modifiedHtml = html;
  
  // Match text content between tags (not inside tags)
  // This regex matches text that is NOT inside < >
  const textPattern = />([^<]+)</g;
  
  let match;
  while ((match = textPattern.exec(html)) !== null) {
    const text = match[1].trim();
    if (text && text.length > 0) {
      segments.push(text);
      const marker = `__TXTMRK${markerIndex}__`;
      markers.push(marker);
      // Replace in modifiedHtml
      modifiedHtml = modifiedHtml.replace(`>${match[1]}<`, `>${marker}<`);
      markerIndex++;
    }
  }
  
  return { segments, markers };
}

/**
 * Translate HTML content while preserving all structure
 * 
 * Strategy: Extract text between tags, translate as one batch, replace back
 */
export async function translateHtmlSimple(
  html: string,
  translateFn: (text: string) => Promise<string>
): Promise<string> {
  console.log('[translateHtmlSimple] Starting, HTML length:', html.length);
  
  // Extract text segments
  const { segments, markers } = extractTextSegments(html);
  console.log(`[translateHtmlSimple] Extracted ${segments.length} text segments`);
  
  if (segments.length === 0) {
    console.log('[translateHtmlSimple] No text found, returning original');
    return html;
  }
  
  // Join segments with a unique separator
  const SEPARATOR = '\n###TXTSEP###\n';
  const combinedText = segments.join(SEPARATOR);
  console.log(`[translateHtmlSimple] Combined text length: ${combinedText.length}`);
  
  // Translate
  const translatedCombined = await translateFn(combinedText);
  console.log(`[translateHtmlSimple] Translated length: ${translatedCombined.length}`);
  
  // Split back
  let translatedSegments: string[];
  if (translatedCombined.includes(SEPARATOR)) {
    translatedSegments = translatedCombined.split(SEPARATOR);
  } else if (translatedCombined.includes('###TXTSEP###')) {
    translatedSegments = translatedCombined.split(/\s*###TXTSEP###\s*/);
  } else {
    console.warn('[translateHtmlSimple] Separator not found, using original');
    translatedSegments = segments;
  }
  
  console.log(`[translateHtmlSimple] Split into ${translatedSegments.length} segments`);
  
  // Replace markers with translated text
  let result = html;
  markers.forEach((marker, index) => {
    const translatedText = translatedSegments[index] || segments[index];
    result = result.replace(marker, translatedText);
  });
  
  console.log(`[translateHtmlSimple] Result length: ${result.length}`);
  return result;
}

/**
 * Alternative approach: Just send the HTML directly to translation
 * Let the translation API handle it (works with some APIs)
 */
export async function translateHtmlDirect(
  html: string,
  translateFn: (text: string) => Promise<string>
): Promise<string> {
  console.log('[translateHtmlDirect] Translating HTML directly');
  
  // Add instruction to preserve HTML tags
  const instruction = 'Translate the following HTML content. Preserve all HTML tags exactly as they are. Only translate the text content between tags:\n\n';
  const result = await translateFn(instruction + html);
  
  // Remove the instruction from the result if it's there
  return result.replace(instruction, '');
}
