import * as cheerio from 'cheerio';
import mammoth from 'mammoth';
import { readFileSync } from 'fs';

async function translateHtmlWithCheerio(html, translateFn) {
  console.log('[translateHtmlWithCheerio] Starting, HTML length:', html.length);
  
  // Load HTML into cheerio
  const $ = cheerio.load(html, {
    decodeEntities: false,
    xmlMode: false,
  });
  
  // Collect all text nodes
  const textSegments = [];
  const textNodes = [];
  
  // Walk through all elements and collect text
  function collectText(element) {
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
  let translatedTexts;
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
  const translatedHtml = await translateHtmlWithCheerio(originalHtml, mockTranslate);
  
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
