import { readFileSync, writeFileSync } from 'fs';
import mammoth from 'mammoth';
import { Document, Paragraph, TextRun, Packer } from 'docx';

async function translateWithVerbum(text, from = 'en', to = 'es') {
  const apiKey = process.env.VERBUM_API_KEY;
  if (!apiKey) {
    throw new Error('VERBUM_API_KEY not set');
  }
  
  console.log(`Translating ${text.length} characters from ${from} to ${to}...`);
  
  const response = await fetch('https://sdk.verbum.ai/v1/translator/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      texts: [{ text }],
      from,
      to: [to],
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Verbum API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  return data.translations[0][0].text;
}

async function test() {
  console.log('=== Full Translation Test with Mammoth + Verbum API ===\n');
  
  try {
    // Step 1: Load original DOCX
    console.log('Step 1: Loading original DOCX...');
    const buffer = readFileSync('/home/ubuntu/upload/DOCX_TestPage.docx');
    console.log('✓ File loaded:', buffer.length, 'bytes\n');
    
    // Step 2: Extract text
    console.log('Step 2: Extracting text with mammoth...');
    const result = await mammoth.extractRawText({ buffer });
    const originalText = result.value;
    console.log('✓ Extracted:', originalText.length, 'characters');
    console.log('Preview:', originalText.substring(0, 150), '...\n');
    
    // Step 3: Translate with Verbum API
    console.log('Step 3: Translating with Verbum API...');
    const translatedText = await translateWithVerbum(originalText, 'en', 'es');
    console.log('✓ Translated:', translatedText.length, 'characters');
    console.log('Preview:', translatedText.substring(0, 150), '...\n');
    
    // Step 4: Create new DOCX
    console.log('Step 4: Creating translated DOCX...');
    const paragraphs = translatedText
      .split('\n')
      .filter(p => p.trim() !== '')
      .map(text => 
        new Paragraph({
          children: [new TextRun(text)],
        })
      );
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs,
      }],
    });
    
    const newBuffer = await Packer.toBuffer(doc);
    const outputPath = '/home/ubuntu/upload/DOCX_TestPage_TRANSLATED.docx';
    writeFileSync(outputPath, newBuffer);
    console.log('✓ Created:', outputPath);
    console.log('  Size:', newBuffer.length, 'bytes\n');
    
    console.log('=== SUCCESS ===');
    console.log('The translated DOCX file is ready!');
    console.log('Try opening it in Word to verify it works.');
    
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    process.exit(1);
  }
}

test();
