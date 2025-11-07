import mammoth from 'mammoth';
import HTMLtoDOCX from '@turbodocx/html-to-docx';
import { readFileSync, writeFileSync } from 'fs';

async function testDocument(filename) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${filename}`);
  console.log('='.repeat(60));
  
  try {
    const buffer = readFileSync(filename);
    
    // Step 1: Extract HTML from DOCX
    console.log('\n1. Extracting HTML from DOCX...');
    const result = await mammoth.convertToHtml({ buffer });
    const originalHtml = result.value;
    console.log(`   HTML length: ${originalHtml.length}`);
    console.log(`   Paragraphs: ${(originalHtml.match(/<p>/g) || []).length}`);
    console.log(`   Headings: ${(originalHtml.match(/<h[1-6]>/g) || []).length}`);
    console.log(`   Lists: ${(originalHtml.match(/<ul>|<ol>/g) || []).length}`);
    console.log(`   Tables: ${(originalHtml.match(/<table>/g) || []).length}`);
    
    // Show first 500 chars
    console.log(`\n   First 500 chars of extracted HTML:`);
    console.log(`   ${originalHtml.substring(0, 500)}...`);
    
    // Step 2: Mock translation (just add [ES] prefix)
    console.log('\n2. Simulating translation...');
    const translatedHtml = originalHtml.replace(/<p>([^<]+)<\/p>/g, (match, text) => {
      return `<p>[ES] ${text}</p>`;
    });
    console.log(`   Translated HTML length: ${translatedHtml.length}`);
    
    // Step 3: Convert back to DOCX with TurboDocx
    console.log('\n3. Converting HTML back to DOCX with TurboDocx...');
    
    // Wrap HTML in complete document
    const wrappedHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Translated Document</title>
</head>
<body>
${translatedHtml}
</body>
</html>`;
    
    const docxBuffer = await HTMLtoDOCX(wrappedHtml, null, {
      title: 'Translated Document',
      creator: 'Test',
      orientation: 'portrait',
    });
    
    // Convert to Buffer
    let finalBuffer;
    if (Buffer.isBuffer(docxBuffer)) {
      finalBuffer = docxBuffer;
    } else if (docxBuffer instanceof ArrayBuffer) {
      finalBuffer = Buffer.from(new Uint8Array(docxBuffer));
    } else {
      const arrayBuffer = await docxBuffer.arrayBuffer();
      finalBuffer = Buffer.from(new Uint8Array(arrayBuffer));
    }
    
    console.log(`   Output DOCX size: ${finalBuffer.length} bytes`);
    
    // Save output
    const outputFilename = filename.replace('.docx', '_formatted_output.docx');
    writeFileSync(outputFilename, finalBuffer);
    console.log(`   ✓ Saved to: ${outputFilename}`);
    
    // Step 4: Extract HTML from output to verify
    console.log('\n4. Verifying output structure...');
    const verifyResult = await mammoth.convertToHtml({ buffer: finalBuffer });
    const outputHtml = verifyResult.value;
    console.log(`   Output HTML length: ${outputHtml.length}`);
    console.log(`   Paragraphs: ${(outputHtml.match(/<p>/g) || []).length}`);
    console.log(`   Headings: ${(outputHtml.match(/<h[1-6]>/g) || []).length}`);
    console.log(`   Lists: ${(outputHtml.match(/<ul>|<ol>/g) || []).length}`);
    console.log(`   Tables: ${(outputHtml.match(/<table>/g) || []).length}`);
    
    // Check for issues
    if (outputHtml.includes('SEGMENT') || outputHtml.includes('SEGMENTO')) {
      console.log(`   ⚠️  WARNING: Segment markers found in output!`);
    }
    
    console.log(`\n   First 500 chars of output HTML:`);
    console.log(`   ${outputHtml.substring(0, 500)}...`);
    
    console.log(`\n✓ Test complete for ${filename}`);
    
  } catch (error) {
    console.error(`✗ Error:`, error.message);
    console.error(error.stack);
  }
}

// Test both documents
await testDocument('eula.docx');
await testDocument('iKunnect_API_Integration_Guide.docx');

console.log(`\n${'='.repeat(60)}`);
console.log('All tests complete');
console.log('='.repeat(60));
