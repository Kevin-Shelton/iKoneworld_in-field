import { JSDOM } from 'jsdom';
import mammoth from 'mammoth';
import { readFileSync } from 'fs';

async function translateHtmlWithDOM(html, translateFn) {
  console.log('[translateHtmlWithDOM] Starting, HTML length:', html.length);
  
  // Parse HTML into DOM
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`);
  const document = dom.window.document;
  const body = document.body;
  
  // Collect all text nodes
  const textNodes = [];
  const textContents = [];
  
  function collectTextNodes(node) {
    if (node.nodeType === 3) { // Text node
      const text = node.textContent?.trim();
      if (text && text.length > 0) {
        textNodes.push(node);
        textContents.push(text);
      }
    } else if (node.nodeType === 1) { // Element node
      // Recursively process child nodes
      node.childNodes.forEach(collectTextNodes);
    }
  }
  
  collectTextNodes(body);
  console.log(`[translateHtmlWithDOM] Found ${textNodes.length} text nodes`);
  console.log(`[translateHtmlWithDOM] First 5 text nodes:`, textContents.slice(0, 5));
  
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
  let translatedTexts;
  if (translatedCombined.includes(SEPARATOR)) {
    translatedTexts = translatedCombined.split(SEPARATOR);
  } else if (translatedCombined.includes('###TXTSEP###')) {
    translatedTexts = translatedCombined.split(/\s*###TXTSEP###\s*/);
  } else {
    console.warn('[translateHtmlWithDOM] Separator not found, using original');
    translatedTexts = textContents;
  }
  
  console.log(`[translateHtmlWithDOM] Split into ${translatedTexts.length} segments`);
  console.log(`[translateHtmlWithDOM] First 5 translated:`, translatedTexts.slice(0, 5));
  
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

async function testDocument(filename) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${filename}`);
  console.log('='.repeat(60) + '\n');
  
  const buffer = readFileSync(filename);
  
  // Extract HTML
  const result = await mammoth.convertToHtml({ buffer });
  const originalHtml = result.value;
  
  console.log('Original HTML:');
  console.log(`  Length: ${originalHtml.length}`);
  console.log(`  Paragraphs: ${(originalHtml.match(/<p>/g) || []).length}`);
  console.log(`  Headings: ${(originalHtml.match(/<h[1-6]>/g) || []).length}`);
  console.log(`  Lists: ${(originalHtml.match(/<ul>|<ol>/g) || []).length}`);
  console.log(`  Tables: ${(originalHtml.match(/<table>/g) || []).length}\n`);
  
  // Mock translate function
  const mockTranslate = async (text) => {
    return '[ES] ' + text;
  };
  
  // Translate HTML
  const translatedHtml = await translateHtmlWithDOM(originalHtml, mockTranslate);
  
  console.log('\nTranslated HTML:');
  console.log(`  Length: ${translatedHtml.length}`);
  console.log(`  Paragraphs: ${(translatedHtml.match(/<p>/g) || []).length}`);
  console.log(`  Headings: ${(translatedHtml.match(/<h[1-6]>/g) || []).length}`);
  console.log(`  Lists: ${(translatedHtml.match(/<ul>|<ol>/g) || []).length}`);
  console.log(`  Tables: ${(translatedHtml.match(/<table>/g) || []).length}`);
  console.log(`  First 300 chars: ${translatedHtml.substring(0, 300)}...\n`);
  
  // Check if structure is preserved
  const checks = [
    { name: 'Paragraphs', original: (originalHtml.match(/<p>/g) || []).length, translated: (translatedHtml.match(/<p>/g) || []).length },
    { name: 'Headings', original: (originalHtml.match(/<h[1-6]>/g) || []).length, translated: (translatedHtml.match(/<h[1-6]>/g) || []).length },
    { name: 'Lists', original: (originalHtml.match(/<ul>|<ol>/g) || []).length, translated: (translatedHtml.match(/<ul>|<ol>/g) || []).length },
    { name: 'Tables', original: (originalHtml.match(/<table>/g) || []).length, translated: (translatedHtml.match(/<table>/g) || []).length },
  ];
  
  console.log('Structure preservation:');
  checks.forEach(check => {
    if (check.original === check.translated) {
      console.log(`  ✓ ${check.name}: ${check.original} → ${check.translated}`);
    } else {
      console.log(`  ✗ ${check.name}: ${check.original} → ${check.translated}`);
    }
  });
}

await testDocument('eula.docx');
await testDocument('iKunnect_API_Integration_Guide.docx');
