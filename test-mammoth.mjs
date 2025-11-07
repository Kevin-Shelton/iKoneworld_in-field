import { readFileSync, writeFileSync } from 'fs';
import mammoth from 'mammoth';
import { Document, Paragraph, TextRun, Packer } from 'docx';

async function test() {
  console.log('=== Testing Mammoth-based Processor ===\n');
  
  const buffer = readFileSync('/home/ubuntu/upload/DOCX_TestPage.docx');
  
  // Extract text
  console.log('Step 1: Extracting text...');
  const result = await mammoth.extractRawText({ buffer });
  const originalText = result.value;
  console.log('Extracted text length:', originalText.length);
  console.log('Text preview:', originalText.substring(0, 200));
  
  // Simulate translation
  console.log('\nStep 2: Simulating translation...');
  const translatedText = originalText
    .split('\n')
    .map(line => '[ES] ' + line)
    .join('\n');
  
  // Create new DOCX
  console.log('\nStep 3: Creating translated DOCX...');
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
  writeFileSync('/home/ubuntu/upload/test_mammoth_output.docx', newBuffer);
  
  console.log('\n✓ Success!');
  console.log('Output file:', '/home/ubuntu/upload/test_mammoth_output.docx');
  console.log('Output size:', newBuffer.length, 'bytes');
}

test().catch(console.error);
