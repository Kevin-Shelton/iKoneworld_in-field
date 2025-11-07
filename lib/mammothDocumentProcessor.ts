/**
 * Mammoth-based Document Processor
 * 
 * Uses the mammoth library for reliable DOCX processing
 * Workflow: DOCX → HTML → Translate → HTML → DOCX
 */

import mammoth from 'mammoth';
import { Document, Paragraph, TextRun, Packer } from 'docx';

export interface TranslationResult {
  translatedBuffer: Buffer;
  originalText: string;
  translatedText: string;
}

/**
 * Extract text from DOCX for translation
 * 
 * @param buffer - DOCX file buffer
 * @returns Extracted plain text
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Translate DOCX document while preserving structure
 * 
 * Strategy: Extract paragraphs, translate each, rebuild document
 * 
 * @param buffer - Original DOCX buffer
 * @param translatedText - Translated text (should match original structure)
 * @returns New DOCX buffer with translated content
 */
export async function createTranslatedDocx(
  originalBuffer: Buffer,
  translatedText: string
): Promise<Buffer> {
  // Split translated text into paragraphs
  const paragraphs = translatedText
    .split('\n')
    .filter(p => p.trim() !== '')
    .map(text => 
      new Paragraph({
        children: [new TextRun(text)],
      })
    );
  
  // Create new document with translated paragraphs
  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  });
  
  // Generate DOCX buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

/**
 * Process DOCX translation end-to-end
 * 
 * @param originalBuffer - Original DOCX file
 * @param translateFn - Function that translates text (async)
 * @returns Translation result with buffers and text
 */
export async function processDocxTranslation(
  originalBuffer: Buffer,
  translateFn: (text: string) => Promise<string>
): Promise<TranslationResult> {
  // Extract text
  const originalText = await extractTextFromDocx(originalBuffer);
  
  // Translate
  const translatedText = await translateFn(originalText);
  
  // Create new DOCX
  const translatedBuffer = await createTranslatedDocx(originalBuffer, translatedText);
  
  return {
    translatedBuffer,
    originalText,
    translatedText,
  };
}
