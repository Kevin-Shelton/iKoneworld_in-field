import { readFileSync, writeFileSync } from 'fs';
import JSZip from 'jszip';

// Inline skeleton processor functions
function stripDocument(xml) {
  const SPECIAL_CHARACTERS = ['§', '¶', '¤', '☼', '♦', '♫', '♪', '✓', '✗', '⚑', '⚡', '⚙'];
  const special = SPECIAL_CHARACTERS.find(char => !xml.includes(char));
  
  if (!special) throw new Error('No unique special character available');

  const textTagRegex = /(<w:t[^>]*>)(.*?)(<\/w:t>)/g;
  let parsed = '';
  let counter = 1;
  let skeletonXml = xml;
  const matches = [];
  
  let match;
  while ((match = textTagRegex.exec(xml)) !== null) {
    matches.push({
      fullMatch: match[0],
      openTag: match[1],
      text: match[2],
      closeTag: match[3],
      index: match.index,
    });
  }
  
  // Collect non-empty text segments
  for (const m of matches) {
    if (m.text.trim() !== '') {
      parsed += special + m.text;
    }
  }
  
  // Process matches in reverse to maintain indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m.text.trim() === '') continue;
    
    const marker = special + counter;
    const replacement = m.openTag + marker + m.closeTag;
    skeletonXml = skeletonXml.substring(0, m.index) + replacement + skeletonXml.substring(m.index + m.fullMatch.length);
    counter++;
  }
  
  return { parsed, map: skeletonXml, special };
}

function buildDocument(translatedText, map, special) {
  const parts = translatedText.split(special);
  const segments = parts.filter(p => p.trim() !== '');
  
  let result = map;
  for (let counter = segments.length; counter >= 1; counter--) {
    const marker = special + counter;
    const translation = segments[counter - 1];
    
    if (translation !== undefined) {
      const escapedTranslation = translation
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
      
      const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(
        new RegExp(`(<w:t[^>]*>)${escapedMarker}(<\\/w:t>)`, 'g'),
        `$1${escapedTranslation}$2`
      );
    }
  }
  
  return result;
}

// Test
async function test() {
  console.log('Testing DOCX processing...\n');
  
  const buffer = readFileSync('/home/ubuntu/upload/DOCX_TestPage.docx');
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('text');
  
  console.log('Original XML length:', documentXml.length);
  
  const { parsed, map, special } = stripDocument(documentXml);
  console.log('Extracted text length:', parsed.length);
  console.log('Delimiter:', special);
  console.log('Text preview:', parsed.substring(0, 200));
  
  // Simulate translation
  const segments = parsed.split(special).filter(s => s.trim() !== '');
  const translatedSegments = segments.map(s => '[TRANSLATED] ' + s);
  const translatedText = special + translatedSegments.join(special) + special;
  
  const newXml = buildDocument(translatedText, map, special);
  console.log('New XML length:', newXml.length);
  
  zip.file('word/document.xml', newXml);
  const newBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  
  writeFileSync('/home/ubuntu/upload/test_output.docx', newBuffer);
  console.log('\n✓ Saved to /home/ubuntu/upload/test_output.docx');
}

test().catch(console.error);
