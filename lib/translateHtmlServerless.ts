/**
 * Serverless-friendly HTML Translation
 * 
 * Uses cheerio (lightweight jQuery-like library) instead of JSDOM
 * Works reliably in Vercel serverless functions
 */

import * as cheerio from 'cheerio';

/**
 * Translate HTML content using cheerio (serverless-compatible)
 * 
 * Cheerio is much lighter than JSDOM and works perfectly in serverless
 * It provides jQuery-like API for DOM manipulation
 */
export async function translateHtmlWithCheerio(
  html: string,
  translateFn: (text: string) => Promise<string>
): Promise<string> {
  console.log('[translateHtmlWithCheerio] Starting, HTML length:', html.length);
  
  // Load HTML into cheerio
  const $ = cheerio.load(html, {
    xml: false,
  });
  
  // Collect all text nodes
  const textSegments: string[] = [];
  const textNodes: Array<{ element: cheerio.Cheerio<any>; originalText: string }> = [];
  
  // Walk through all elements and collect text
  function collectText(element: cheerio.Cheerio<any>) {
    element.contents().each((_, node) => {
      if (node.type === 'text') {
        const text = $(node).text().trim();
        if (text && text.length > 0) {
          textSegments.push(text);
          textNodes.push({
            element: $(node),
            originalText: text,
          });
        }
      } else if (node.type === 'tag') {
        // Recursively process child elements
        collectText($(node));
      }
    });
  }
  
  // Start from body or root
  collectText($('body').length > 0 ? $('body') : $.root());
  
  console.log(`[translateHtmlWithCheerio] Found ${textNodes.length} text nodes`);
  console.log(`[translateHtmlWithCheerio] First 5 texts:`, textSegments.slice(0, 5));
  
  if (textNodes.length === 0) {
    console.log('[translateHtmlWithCheerio] No text found, returning original');
    return html;
  }
  
  // Translate all text together
  const SEPARATOR = '\n###TXTSEP###\n';
  const combinedText = textSegments.join(SEPARATOR);
  console.log(`[translateHtmlWithCheerio] Combined text length: ${combinedText.length}`);
  
  const translatedCombined = await translateFn(combinedText);
  console.log(`[translateHtmlWithCheerio] Translated length: ${translatedCombined.length}`);
  
  // Split translated text
  let translatedTexts: string[];
  if (translatedCombined.includes(SEPARATOR)) {
    translatedTexts = translatedCombined.split(SEPARATOR);
  } else if (translatedCombined.includes('###TXTSEP###')) {
    translatedTexts = translatedCombined.split(/\s*###TXTSEP###\s*/);
  } else {
    console.warn('[translateHtmlWithCheerio] Separator not found, using original');
    translatedTexts = textSegments;
  }
  
  console.log(`[translateHtmlWithCheerio] Split into ${translatedTexts.length} segments`);
  console.log(`[translateHtmlWithCheerio] First 5 translated:`, translatedTexts.slice(0, 5));
  
  // Replace text nodes with translations
  textNodes.forEach((node, index) => {
    const translatedText = translatedTexts[index] || node.originalText;
    node.element.replaceWith(translatedText);
  });
  
  // Get the HTML back
  const result = $('body').length > 0 ? $('body').html() || '' : $.html();
  console.log(`[translateHtmlWithCheerio] Result length: ${result.length}`);
  
  return result;
}
