const fs = require('fs');
const path = require('path');

// Import the structure preserver
const { translateDocxWithStructure } = require('./lib/docxStructurePreserver.ts');

async function testTranslation() {
  try {
    const inputPath = '/home/ubuntu/upload/Invictus_DR_Overview_2025_External.docx';
    const outputPath = '/home/ubuntu/upload/test_translated.docx';
    
    // Read original file
    const originalBuffer = fs.readFileSync(inputPath);
    console.log('Original file size:', originalBuffer.length);
    
    // Mock translation function (just returns same text for testing)
    const mockTranslate = async (text) => {
      return `[ES] ${text}`;
    };
    
    // Translate
    console.log('Starting translation...');
    const result = await translateDocxWithStructure(originalBuffer, mockTranslate);
    
    // Save translated file
    fs.writeFileSync(outputPath, result.translatedBuffer);
    console.log('Translated file saved:', outputPath);
    console.log('Translated file size:', result.translatedBuffer.length);
    
  } catch (error) {
    console.error('Translation error:', error);
  }
}

testTranslation();
