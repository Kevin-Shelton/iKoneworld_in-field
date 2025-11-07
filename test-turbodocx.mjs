/**
 * Test TurboDocx HTML to DOCX conversion
 */

import { readFileSync, writeFileSync } from 'fs';
import { convertDocxToHtml } from './lib/mammothDocumentProcessor.ts';
import { convertHtmlToDocx, wrapHtmlDocument } from './lib/turbodocxConverter.ts';

async function testTurboDocx() {
  console.log('=== Testing TurboDocx Integration ===\n');
  
  // Test 1: Simple HTML with formatting
  console.log('Test 1: Simple HTML with formatting');
  const simpleHtml = `
    <h1>Test Document</h1>
    <p>This is a <strong>bold</strong> and <em>italic</em> test.</p>
    <h2>Features</h2>
    <ul>
      <li>Bullet point 1</li>
      <li>Bullet point 2</li>
    </ul>
    <table>
      <tr><th>Header 1</th><th>Header 2</th></tr>
      <tr><td>Cell 1</td><td>Cell 2</td></tr>
    </table>
  `;
  
  try {
    const wrappedHtml = wrapHtmlDocument(simpleHtml);
    const buffer = await convertHtmlToDocx(wrappedHtml);
    writeFileSync('test-turbodocx-output.docx', buffer);
    console.log('✅ Created test-turbodocx-output.docx');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n=== Test Complete ===');
}

testTurboDocx().catch(console.error);
