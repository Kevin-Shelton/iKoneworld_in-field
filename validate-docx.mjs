import JSZip from 'jszip';
import { readFileSync } from 'fs';

async function validate(filepath) {
  console.log('Validating:', filepath, '\n');
  
  try {
    const buffer = readFileSync(filepath);
    const zip = await JSZip.loadAsync(buffer);
    
    // Check required files
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
    }
    
    // Check document.xml structure
    const docXml = await zip.file('word/document.xml').async('text');
    console.log('\nDocument.xml validation:');
    console.log('  Length:', docXml.length);
    console.log('  Has <w:document>:', docXml.includes('<w:document'));
    console.log('  Has </w:document>:', docXml.includes('</w:document>'));
    console.log('  Has <w:body>:', docXml.includes('<w:body'));
    console.log('  Has </w:body>:', docXml.includes('</w:body>'));
    
    // Check for XML errors
    const hasUnclosedTags = /<w:t[^>]*>[^<]*$/.test(docXml);
    const hasMismatchedBrackets = (docXml.match(/</g) || []).length !== (docXml.match(/>/g) || []).length;
    
    console.log('\nXML structure:');
    console.log('  Unclosed tags:', hasUnclosedTags ? '✗ YES (ERROR)' : '✓ No');
    console.log('  Mismatched brackets:', hasMismatchedBrackets ? '✗ YES (ERROR)' : '✓ No');
    
    // Sample some text content
    const textMatches = docXml.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (textMatches) {
      console.log('\nSample text nodes (first 5):');
      textMatches.slice(0, 5).forEach((match, i) => {
        const text = match.replace(/<[^>]+>/g, '');
        console.log(`  ${i + 1}. "${text}"`);
      });
    }
    
    console.log('\n✓ File structure is valid');
    
  } catch (error) {
    console.error('\n✗ Validation failed:', error.message);
  }
}

validate('/home/ubuntu/upload/test_output.docx');
