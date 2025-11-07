import { processDocxTranslation } from './lib/mammothDocumentProcessor.js';
import { readFileSync, writeFileSync } from 'fs';

async function testDocument(filename) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${filename}`);
  console.log('='.repeat(60));
  
  try {
    const buffer = readFileSync(filename);
    
    // Mock translate function that just adds [ES] prefix
    const mockTranslate = async (text) => {
      return '[ES] ' + text;
    };
    
    const result = await processDocxTranslation(
      buffer,
      'en',
      'es',
      mockTranslate
    );
    
    console.log(`✓ Translation successful`);
    console.log(`  Output size: ${result.length} bytes`);
    
    // Save output
    const outputFilename = filename.replace('.docx', '_test_output.docx');
    writeFileSync(outputFilename, result);
    console.log(`  Saved to: ${outputFilename}`);
    
    // Extract and show HTML to check structure
    const mammoth = (await import('mammoth')).default;
    const htmlResult = await mammoth.convertToHtml({ buffer: result });
    const html = htmlResult.value;
    
    console.log(`\n  HTML structure check:`);
    console.log(`    Paragraphs: ${(html.match(/<p>/g) || []).length}`);
    console.log(`    Headings: ${(html.match(/<h[1-6]>/g) || []).length}`);
    console.log(`    Lists: ${(html.match(/<ul>|<ol>/g) || []).length}`);
    console.log(`    Tables: ${(html.match(/<table>/g) || []).length}`);
    console.log(`    Bold: ${(html.match(/<strong>/g) || []).length}`);
    
    // Check for segment markers
    if (html.includes('SEGMENT') || html.includes('SEGMENTO')) {
      console.log(`  ⚠️  WARNING: Segment markers found in output!`);
    }
    
    // Show first 500 chars of HTML
    console.log(`\n  First 500 chars of HTML:`);
    console.log(`  ${html.substring(0, 500)}...`);
    
  } catch (error) {
    console.error(`✗ Error:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Test both documents
await testDocument('eula.docx');
await testDocument('iKunnect_API_Integration_Guide.docx');

console.log(`\n${'='.repeat(60)}`);
console.log('Testing complete');
console.log('='.repeat(60));
