import { readFileSync, writeFileSync } from 'fs';
import JSZip from 'jszip';
import { stripDocument, buildDocument } from './lib/skeletonDocumentProcessor.js';

async function testSkeletonMethod() {
  console.log('=== Testing Skeleton Method ===\n');
  
  // Read the test file
  const filePath = '/home/ubuntu/upload/DOCX_TestPage.docx';
  console.log('1. Reading file:', filePath);
  const buffer = readFileSync(filePath);
  console.log('   File size:', buffer.length, 'bytes\n');
  
  // Extract document.xml
  console.log('2. Extracting document.xml...');
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('text');
  console.log('   Original XML length:', documentXml.length, 'characters\n');
  
  // Strip text from document
  console.log('3. Stripping text from document...');
  const { parsed, map, special } = stripDocument(documentXml);
  console.log('   Extracted text length:', parsed.length, 'characters');
  console.log('   Delimiter used:', special);
  console.log('   Text preview:', parsed.substring(0, 100), '...\n');
  
  // Simulate translation (just add prefix for testing)
  console.log('4. Simulating translation...');
  const segments = parsed.split(special).filter(s => s.trim() !== '');
  console.log('   Number of segments:', segments.length);
  const translatedSegments = segments.map(s => '[ES] ' + s);
  const translatedText = special + translatedSegments.join(special) + special;
  console.log('   Translated text length:', translatedText.length, 'characters\n');
  
  // Build document with translations
  console.log('5. Building document with translations...');
  const newDocumentXml = buildDocument(translatedText, map, special);
  console.log('   New XML length:', newDocumentXml.length, 'characters\n');
  
  // Validate XML structure
  console.log('6. Validating XML structure...');
  const hasDocumentTag = newDocumentXml.includes('<w:document');
  const hasClosingTag = newDocumentXml.includes('</w:document>');
  const hasBody = newDocumentXml.includes('<w:body');
  console.log('   Has <w:document>:', hasDocumentTag);
  console.log('   Has </w:document>:', hasClosingTag);
  console.log('   Has <w:body>:', hasBody);
  
  if (!hasDocumentTag || !hasClosingTag || !hasBody) {
    console.error('   ❌ XML structure is invalid!\n');
    return;
  }
  console.log('   ✓ XML structure looks valid\n');
  
  // Create new DOCX
  console.log('7. Creating new DOCX file...');
  zip.file('word/document.xml', newDocumentXml);
  const newBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  console.log('   New file size:', newBuffer.length, 'bytes\n');
  
  // Save output
  const outputPath = '/home/ubuntu/upload/DOCX_TestPage_translated.docx';
  writeFileSync(outputPath, newBuffer);
  console.log('8. Saved to:', outputPath);
  console.log('\n✓ Test completed! Try opening the translated file.\n');
}

testSkeletonMethod().catch(console.error);
