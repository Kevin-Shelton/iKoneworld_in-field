/**
 * Helper functions for translating HTML content while preserving structure
 */

interface TextSegment {
  text: string;
  index: number;
}

/**
 * Extract text content from HTML while preserving structure
 * Returns an array of text segments and the HTML template
 */
export function extractTextFromHtml(html: string): {
  texts: string[];
  template: string;
} {
  const texts: string[] = [];
  let textIndex = 0;
  
  // Replace text content with placeholders
  const template = html.replace(/>([^<]+)</g, (match, text) => {
    const trimmedText = text.trim();
    if (trimmedText) {
      texts.push(trimmedText);
      return `>__TEXT_${textIndex++}__<`;
    }
    return match;
  });
  
  return { texts, template };
}

/**
 * Reconstruct HTML with translated text
 */
export function reconstructHtmlWithTranslation(
  template: string,
  translatedTexts: string[]
): string {
  let result = template;
  
  translatedTexts.forEach((text, index) => {
    result = result.replace(`__TEXT_${index}__`, text);
  });
  
  return result;
}

/**
 * Translate HTML content while preserving structure
 */
export async function translateHtmlContent(
  html: string,
  translateFn: (texts: string[]) => Promise<string[]>
): Promise<string> {
  // Extract text from HTML
  const { texts, template } = extractTextFromHtml(html);
  
  if (texts.length === 0) {
    return html; // No text to translate
  }
  
  // Translate all text segments
  const translatedTexts = await translateFn(texts);
  
  // Reconstruct HTML with translated text
  return reconstructHtmlWithTranslation(template, translatedTexts);
}
