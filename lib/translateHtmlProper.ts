/**
 * Proper HTML Translation using DOM parsing
 * 
 * Uses JSDOM to parse HTML, extract text nodes, translate them, and reconstruct.
 * This approach preserves ALL HTML structure perfectly.
 */

import { JSDOM } from 'jsdom';

/**
 * Translate HTML content using proper DOM parsing
 * 
 * This is the most reliable approach as it:
 * 1. Parses HTML into a proper DOM tree
 * 2. Extracts only text nodes (not tags)
 * 3. Translates text in batch
 * 4. Replaces text nodes with translations
 * 5. Serializes back to HTML
 */
export async function translateHtmlWithDOM(
  html: string,
  translateFn: (text: string) => Promise<string>
): Promise<string> {
  console.log('[translateHtmlWithDOM] Starting, HTML length:', html.length);
  
  // Parse HTML into DOM
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`);
  const document = dom.window.document;
  const body = document.body;
  
  // Collect all text nodes
  const textNodes: Text[] = [];
  const textContents: string[] = [];
  
  function collectTextNodes(node: Node) {
    if (node.nodeType === 3) { // Text node
      const text = node.textContent?.trim();
      if (text && text.length > 0) {
        textNodes.push(node as Text);
        textContents.push(text);
      }
    } else if (node.nodeType === 1) { // Element node
      // Recursively process child nodes
      node.childNodes.forEach(collectTextNodes);
    }
  }
  
  collectTextNodes(body);
  console.log(`[translateHtmlWithDOM] Found ${textNodes.length} text nodes`);
  
  if (textNodes.length === 0) {
    console.log('[translateHtmlWithDOM] No text found, returning original');
    return html;
  }
  
  // Translate all text together
  const SEPARATOR = '\n###TXTSEP###\n';
  const combinedText = textContents.join(SEPARATOR);
  console.log(`[translateHtmlWithDOM] Combined text length: ${combinedText.length}`);
  
  const translatedCombined = await translateFn(combinedText);
  console.log(`[translateHtmlWithDOM] Translated length: ${translatedCombined.length}`);
  
  // Split translated text
  let translatedTexts: string[];
  if (translatedCombined.includes(SEPARATOR)) {
    translatedTexts = translatedCombined.split(SEPARATOR);
  } else if (translatedCombined.includes('###TXTSEP###')) {
    translatedTexts = translatedCombined.split(/\s*###TXTSEP###\s*/);
  } else {
    console.warn('[translateHtmlWithDOM] Separator not found, using original');
    translatedTexts = textContents;
  }
  
  console.log(`[translateHtmlWithDOM] Split into ${translatedTexts.length} segments`);
  
  // Replace text nodes with translations
  textNodes.forEach((node, index) => {
    const translatedText = translatedTexts[index] || textContents[index];
    node.textContent = translatedText;
  });
  
  // Serialize back to HTML
  const result = body.innerHTML;
  console.log(`[translateHtmlWithDOM] Result length: ${result.length}`);
  
  return result;
}
