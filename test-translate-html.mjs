import mammoth from 'mammoth';
import { readFileSync } from 'fs';

// Copy the translateHtml function logic to test it
async function translateHtml(html, translateFn) {
  console.log('[Translate HTML] Starting translation, HTML length:', html.length);
  
  const textSegments = [];
  const segmentMarkers = [];
  
  const tagPattern = /<(p|h[1-6]|li|td|th|strong|em|b|i|u|span|div)([^>]*)>(.*?)<\/\1>/gi;
  
  let modifiedHtml = html;
  let match;
  let segmentIndex = 0;
  
  const regex = new RegExp(tagPattern);
  regex.lastIndex = 0;
  
  function extractTextFromHtml(html) {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  while ((match = regex.exec(html)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1];
    const attributes = match[2];
    const content = match[3];
    
    if (!content || !content.trim()) {
      continue;
    }
    
    if (/<[^>]+>/.test(content)) {
      const text = extractTextFromHtml(content);
      if (text) {
        textSegments.push(text);
        const marker = `__SEGMENT_${segmentIndex}__`;
        segmentMarkers.push(marker);
        modifiedHtml = modifiedHtml.replace(fullMatch, `<${tagName}${attributes}>${marker}</${tagName}>`);
        segmentIndex++;
      }
    } else {
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
  
  console.log(`[Translate HTML] Extracted ${textSegments.length} text segments`);
  console.log('[Translate HTML] First 5 segments:', textSegments.slice(0, 5));
  
  if (textSegments.length === 0) {
    console.log('[Translate HTML] No text segments found, returning original');
    return html;
  }
  
  // Translate all segments together
  const MARKER = '\n\n###XSEGX###\n\n';
  const combinedText = textSegments.join(MARKER);
  console.log(`[Translate HTML] Combined text length: ${combinedText.length}`);
  
  const translatedCombined = await translateFn(combinedText);
  console.log(`[Translate HTML] Translated length: ${translatedCombined.length}`);
  
  // Split translated text
  let translatedSegments;
  if (translatedCombined.includes(MARKER)) {
    translatedSegments = translatedCombined.split(MARKER);
  } else if (translatedCombined.includes('###XSEGX###')) {
    translatedSegments = translatedCombined.split(/\s*###XSEGX###\s*/);
  } else {
    console.warn('[Translate HTML] Marker not found, using original segments');
    translatedSegments = textSegments;
  }
  
  console.log(`[Translate HTML] Split into ${translatedSegments.length} translated segments`);
  console.log('[Translate HTML] First 5 translated segments:', translatedSegments.slice(0, 5));
  
  // Replace markers with translated text
  let translatedHtml = modifiedHtml;
  segmentMarkers.forEach((marker, index) => {
    const translatedText = translatedSegments[index] || textSegments[index];
    translatedHtml = translatedHtml.replace(marker, translatedText);
  });
  
  console.log('[Translate HTML] Final HTML length:', translatedHtml.length);
  
  return translatedHtml;
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
  console.log(`  First 300 chars: ${originalHtml.substring(0, 300)}...\n`);
  
  // Mock translate function
  const mockTranslate = async (text) => {
    return '[ES] ' + text;
  };
  
  // Translate HTML
  const translatedHtml = await translateHtml(originalHtml, mockTranslate);
  
  console.log('\nTranslated HTML:');
  console.log(`  Length: ${translatedHtml.length}`);
  console.log(`  Paragraphs: ${(translatedHtml.match(/<p>/g) || []).length}`);
  console.log(`  First 300 chars: ${translatedHtml.substring(0, 300)}...\n`);
  
  // Check if structure is preserved
  const originalPCount = (originalHtml.match(/<p>/g) || []).length;
  const translatedPCount = (translatedHtml.match(/<p>/g) || []).length;
  
  if (originalPCount === translatedPCount) {
    console.log('✓ Paragraph count preserved');
  } else {
    console.log(`✗ Paragraph count changed: ${originalPCount} → ${translatedPCount}`);
  }
}

await testDocument('eula.docx');
await testDocument('iKunnect_API_Integration_Guide.docx');
