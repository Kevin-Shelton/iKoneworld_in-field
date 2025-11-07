/**
 * Test TurboDocx HTML to DOCX conversion (plain JS)
 */

import { writeFileSync } from 'fs';
import HTMLtoDOCX from '@turbodocx/html-to-docx';

async function testTurboDocx() {
  console.log('=== Testing TurboDocx Integration ===\n');
  
  // Test: Simple HTML with formatting
  console.log('Test: HTML with tables, lists, and formatting');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Document</title>
</head>
<body>
  <h1>Test Document</h1>
  <p>This is a <strong>bold</strong> and <em>italic</em> test.</p>
  <h2>Features</h2>
  <ul>
    <li>Bullet point 1</li>
    <li>Bullet point 2</li>
    <li>Bullet point 3</li>
  </ul>
  <h2>Data Table</h2>
  <table border="1">
    <tr><th>Header 1</th><th>Header 2</th></tr>
    <tr><td>Cell 1</td><td>Cell 2</td></tr>
    <tr><td>Cell 3</td><td>Cell 4</td></tr>
  </table>
</body>
</html>`;
  
  try {
    console.log('Converting HTML to DOCX...');
    const docxArrayBuffer = await HTMLtoDOCX(html, null, {
      title: 'Test Document',
      creator: 'TurboDocx Test',
      orientation: 'portrait',
    });
    
    const buffer = Buffer.from(docxArrayBuffer);
    writeFileSync('test-turbodocx-output.docx', buffer);
    console.log('✅ Created test-turbodocx-output.docx (' + buffer.length + ' bytes)');
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  console.log('\n=== Test Complete ===');
}

testTurboDocx().catch(console.error);
