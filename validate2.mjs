import JSZip from 'jszip';
import { readFileSync } from 'fs';

const filepath = process.argv[2] || '/home/ubuntu/upload/test_output.docx';

async function validate() {
  console.log('Validating:', filepath, '\n');
  
  try {
    const buffer = readFileSync(filepath);
    const zip = await JSZip.loadAsync(buffer);
    
    const requiredFiles = [
      'word/document.xml',
      '[Content_Types].xml',
      '_rels/.rels',
      'word/_rels/document.xml.rels'
    ];
    
    console.log('Required files:');
    for (const file of requiredFiles) {
      const exists = zip.file(file) !== null;
      console.log(`  ${exists ? '✓' : '✗'} ${file}`);
      if (!exists) {
        console.error(`\n✗ Missing required file: ${file}`);
        return;
      }
    }
    
    const docXml = await zip.file('word/document.xml').async('text');
    console.log('\nDocument.xml:');
    console.log('  Length:', docXml.length);
    console.log('  Has <w:document>:', docXml.includes('<w:document'));
    console.log('  Has </w:document>:', docXml.includes('</w:document>'));
    
    const textMatches = docXml.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (textMatches) {
      console.log('\nSample text (first 3):');
      textMatches.slice(0, 3).forEach((match, i) => {
        const text = match.replace(/<[^>]+>/g, '');
        console.log(`  ${i + 1}. "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);
      });
    }
    
    console.log('\n✓ File structure is valid!');
    
  } catch (error) {
    console.error('\n✗ Validation failed:', error.message);
  }
}

validate();
