/**
 * Test script for skeleton document processor
 * 
 * This script tests the core skeleton functions with sample Word XML
 */

import { stripDocument, buildDocument } from './lib/skeletonDocumentProcessor';

// Sample Word document XML (simplified)
const sampleXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Hello World</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:b/>
        </w:rPr>
        <w:t>This is a test</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Testing document translation</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

console.log('=== Testing Skeleton Document Processor ===\n');

try {
  // Test 1: Strip document
  console.log('Test 1: Stripping document');
  console.log('Original XML length:', sampleXml.length);
  
  const { parsed, map, special } = stripDocument(sampleXml);
  
  console.log('\nStrip Results:');
  console.log('- Delimiter:', special);
  console.log('- Parsed text:', parsed);
  console.log('- Skeleton length:', map.length);
  console.log('- Skeleton preview:', map.substring(0, 200) + '...');
  
  // Test 2: Simulate translation
  console.log('\n\nTest 2: Simulating translation (English → Spanish)');
  
  // Manually create "translated" text for testing
  const translatedText = parsed
    .replace('Hello World', 'Hola Mundo')
    .replace('This is a test', 'Esta es una prueba')
    .replace('Testing document translation', 'Probando traducción de documentos');
  
  console.log('Translated text:', translatedText);
  
  // Test 3: Build document
  console.log('\n\nTest 3: Building document with translations');
  
  const rebuiltXml = buildDocument(translatedText, map, special);
  
  console.log('Rebuilt XML length:', rebuiltXml.length);
  console.log('Rebuilt XML preview:', rebuiltXml.substring(0, 300) + '...');
  
  // Verify translations are in the output
  const hasHola = rebuiltXml.includes('Hola Mundo');
  const hasPrueba = rebuiltXml.includes('Esta es una prueba');
  const hasProbar = rebuiltXml.includes('Probando traducción de documentos');
  
  console.log('\n\nVerification:');
  console.log('- Contains "Hola Mundo":', hasHola ? '✓' : '✗');
  console.log('- Contains "Esta es una prueba":', hasPrueba ? '✓' : '✗');
  console.log('- Contains "Probando traducción de documentos":', hasProbar ? '✓' : '✗');
  
  if (hasHola && hasPrueba && hasProbar) {
    console.log('\n✅ All tests passed!');
  } else {
    console.log('\n❌ Some tests failed');
  }
  
} catch (error) {
  console.error('\n❌ Error during testing:', error);
  process.exit(1);
}
