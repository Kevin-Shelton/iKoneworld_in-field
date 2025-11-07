/**
 * Test full DOCX translation workflow with TurboDocx
 * Tests: DOCX → HTML → Translate → HTML → DOCX
 */

import { readFileSync, writeFileSync } from 'fs';
import mammoth from 'mammoth';
import HTMLtoDOCX from '@turbodocx/html-to-docx';

// Mock translation function (English to Spanish simulation)
async function mockTranslate(text) {
  // Simple mock: just add "[ES]" prefix to show it was "translated"
  return `[ES] ${text}`;
}

async function testFullWorkflow() {
  console.log('=== Testing Full Translation Workflow ===\n');
  
  // Step 1: Create a test DOCX with various elements
  console.log('Step 1: Creating test DOCX with formatting...');
  const testHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Test</title></head>
<body>
  <h1>Company Report</h1>
  <p>This is a <strong>sample document</strong> with <em>various formatting</em>.</p>
  
  <h2>Key Features</h2>
  <ul>
    <li>Feature one with details</li>
    <li>Feature two with more information</li>
    <li>Feature three is important</li>
  </ul>
  
  <h2>Data Summary</h2>
  <table border="1">
    <tr>
      <th>Quarter</th>
      <th>Revenue</th>
      <th>Growth</th>
    </tr>
    <tr>
      <td>Q1 2024</td>
      <td>$1.2M</td>
      <td>15%</td>
    </tr>
    <tr>
      <td>Q2 2024</td>
      <td>$1.5M</td>
      <td>25%</td>
    </tr>
  </table>
  
  <h2>Conclusion</h2>
  <p>The results show <strong>strong growth</strong> across all metrics.</p>
</body>
</html>`;
  
  const originalDocx = await HTMLtoDOCX(testHtml, null, {
    title: 'Original Document',
    creator: 'Test System',
  });
  const originalBuffer = Buffer.from(originalDocx);
  writeFileSync('test-original.docx', originalBuffer);
  console.log('✅ Created test-original.docx (' + originalBuffer.length + ' bytes)');
  
  // Step 2: Convert DOCX to HTML (mammoth.js)
  console.log('\nStep 2: Converting DOCX to HTML...');
  const htmlResult = await mammoth.convertToHtml({ buffer: originalBuffer });
  const html = htmlResult.value;
  console.log('✅ Converted to HTML (' + html.length + ' chars)');
  console.log('First 200 chars:', html.substring(0, 200));
  
  // Step 3: "Translate" HTML (mock translation)
  console.log('\nStep 3: Translating HTML content...');
  // Extract text segments and translate
  const textPattern = /<(p|h[1-6]|li|td|th)([^>]*)>(.*?)<\/\1>/gi;
  let translatedHtml = html;
  let match;
  const regex = new RegExp(textPattern);
  
  while ((match = regex.exec(html)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1];
    const attributes = match[2];
    const content = match[3];
    
    // Skip if content has nested tags or is empty
    if (/<[^>]+>/.test(content) || !content.trim()) {
      continue;
    }
    
    // Translate the text content
    const translated = await mockTranslate(content);
    const translatedTag = `<${tagName}${attributes}>${translated}</${tagName}>`;
    translatedHtml = translatedHtml.replace(fullMatch, translatedTag);
  }
  
  console.log('✅ Translated HTML');
  console.log('First 200 chars of translated:', translatedHtml.substring(0, 200));
  
  // Step 4: Convert translated HTML back to DOCX (TurboDocx)
  console.log('\nStep 4: Converting translated HTML to DOCX...');
  const wrappedHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Translated</title></head>
<body>
${translatedHtml}
</body>
</html>`;
  
  const translatedDocx = await HTMLtoDOCX(wrappedHtml, null, {
    title: 'Translated Document',
    creator: 'Translation System',
  });
  const translatedBuffer = Buffer.from(translatedDocx);
  writeFileSync('test-translated.docx', translatedBuffer);
  console.log('✅ Created test-translated.docx (' + translatedBuffer.length + ' bytes)');
  
  // Step 5: Verify the translated document
  console.log('\nStep 5: Verifying translated document...');
  const verifyResult = await mammoth.extractRawText({ buffer: translatedBuffer });
  const translatedText = verifyResult.value;
  console.log('✅ Extracted text from translated DOCX:');
  console.log(translatedText.substring(0, 300) + '...');
  
  // Check if translation markers are present
  if (translatedText.includes('[ES]')) {
    console.log('\n✅ SUCCESS: Translation markers found in output!');
  } else {
    console.log('\n⚠️  WARNING: Translation markers not found');
  }
  
  console.log('\n=== Workflow Test Complete ===');
  console.log('Generated files:');
  console.log('  - test-original.docx (original with formatting)');
  console.log('  - test-translated.docx (translated with formatting preserved)');
}

testFullWorkflow().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
