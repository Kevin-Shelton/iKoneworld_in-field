/**
 * Test script for real DOCX file
 */

import { readFileSync } from 'fs';
import { extractDocumentXml, validateDocxStructure } from './lib/docxHandler';
import { stripDocument, buildDocument } from './lib/skeletonDocumentProcessor';

async function testRealDocx() {
  console.log('=== Testing Real DOCX File ===\n');
  
  try {
    // Read the DOCX file
    const filePath = '/home/ubuntu/upload/verizon_quote.docx';
    console.log('Reading file:', filePath);
    const buffer = readFileSync(filePath);
    console.log('File size:', buffer.length, 'bytes');
    
    // Validate structure
    console.log('\n1. Validating DOCX structure...');
    const validation = await validateDocxStructure(buffer);
    console.log('Valid:', validation.isValid);
    if (!validation.isValid) {
      console.log('Errors:', validation.errors);
      return;
    }
    
    // Extract document.xml
    console.log('\n2. Extracting document.xml...');
    const documentXml = await extractDocumentXml(buffer);
    console.log('Extracted XML length:', documentXml.length, 'characters');
    console.log('XML preview:', documentXml.substring(0, 200) + '...');
    
    // Strip document
    console.log('\n3. Stripping document...');
    const { parsed, map, special } = stripDocument(documentXml);
    console.log('Delimiter:', special);
    console.log('Parsed text length:', parsed.length, 'characters');
    console.log('Parsed text preview:', parsed.substring(0, 300));
    
    // Simulate translation (just uppercase for testing)
    console.log('\n4. Simulating translation...');
    const translatedText = parsed.toUpperCase();
    console.log('Translated text preview:', translatedText.substring(0, 300));
    
    // Build document
    console.log('\n5. Building document...');
    const rebuiltXml = buildDocument(translatedText, map, special);
    console.log('Rebuilt XML length:', rebuiltXml.length, 'characters');
    
    console.log('\n✅ All steps completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testRealDocx();
