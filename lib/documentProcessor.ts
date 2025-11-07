import mammoth from 'mammoth';
import { convertDocxToHtml } from './mammothDocumentProcessor';
import { sanitizeForPDF } from './pdfTextSanitizer';
import { extractPDFStructure, reconstructPDFWithStructure, type PDFStructure } from './pdfStructureExtractor';
// Note: convertHtmlToDocx is dynamically imported to avoid DOMMatrix errors

/**
 * Extract text from a document based on file type
 */
export async function extractTextFromDocument(
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  try {
    switch (mimeType) {
      case 'application/pdf':
        return await extractTextFromPDF(fileBuffer);
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return await extractTextFromDOCX(fileBuffer);
      
      case 'text/plain':
        return extractTextFromTXT(fileBuffer);
      
      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error('Error extracting text from document:', error);
    throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract HTML from DOCX with formatting preserved
 * Used for chunking large documents while maintaining formatting
 */
export async function extractHtmlFromDocument(
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  try {
    switch (mimeType) {
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return await convertDocxToHtml(fileBuffer);
      
      case 'text/plain':
        // Wrap plain text in HTML
        const text = extractTextFromTXT(fileBuffer);
        return text.split('\n\n').map(p => `<p>${p}</p>`).join('\n');
      
      case 'application/pdf':
        // For PDF, extract text and wrap in HTML
        const pdfText = await extractTextFromPDF(fileBuffer);
        return pdfText.split('\n\n').map(p => `<p>${p}</p>`).join('\n');
      
      default:
        throw new Error(`Unsupported file type for HTML extraction: ${mimeType}`);
    }
  } catch (error) {
    console.error('Error extracting HTML from document:', error);
    throw new Error(`Failed to extract HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from PDF using pdf2json with structure preservation
 */
async function extractTextFromPDF(fileBuffer: Buffer): Promise<string> {
  const structure = await extractPDFStructure(fileBuffer);
  return structure.formattedText;
}

/**
 * Extract text from DOCX
 */
async function extractTextFromDOCX(fileBuffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  return result.value;
}

/**
 * Extract text from TXT
 */
function extractTextFromTXT(fileBuffer: Buffer): string {
  return fileBuffer.toString('utf-8');
}

/**
 * Split HTML into chunks for translation while preserving tags
 * This is smarter than plain text chunking - it keeps HTML structure intact
 */
export function chunkHtml(html: string, maxChunkSize: number = 5000): string[] {
  const chunks: string[] = [];
  
  // Split by paragraph tags
  const paragraphPattern = /<(p|h[1-6]|li|div)[^>]*>.*?<\/\1>/gi;
  const paragraphs = html.match(paragraphPattern) || [];
  
  if (paragraphs.length === 0) {
    // Fallback: if no paragraphs found, chunk by plain text
    console.warn('[Chunk HTML] No HTML paragraphs found, falling back to text chunking');
    return chunkText(html, maxChunkSize);
  }
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the limit
    if (currentChunk.length + paragraph.length > maxChunkSize) {
      // Save current chunk if it has content
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      
      // If the paragraph itself is too long, we need to split it
      if (paragraph.length > maxChunkSize) {
        // Extract tag and content
        const tagMatch = paragraph.match(/<([a-z0-9]+)([^>]*)>(.*)<\/\1>/i);
        if (tagMatch) {
          const [, tagName, attributes, content] = tagMatch;
          
          // Split content by sentences
          const sentences = content.split(/([.!?]+\s+)/);
          let sentenceChunk = '';
          
          for (let i = 0; i < sentences.length; i += 2) {
            const sentence = sentences[i] + (sentences[i + 1] || '');
            const wrappedSentence = `<${tagName}${attributes}>${sentence}</${tagName}>`;
            
            if (sentenceChunk.length + wrappedSentence.length > maxChunkSize) {
              if (sentenceChunk.trim()) {
                chunks.push(sentenceChunk.trim());
              }
              sentenceChunk = wrappedSentence;
            } else {
              sentenceChunk += wrappedSentence;
            }
          }
          
          if (sentenceChunk.trim()) {
            currentChunk = sentenceChunk;
          } else {
            currentChunk = '';
          }
        } else {
          // Can't parse, just add as is
          currentChunk = paragraph;
        }
      } else {
        currentChunk = paragraph;
      }
    } else {
      currentChunk += paragraph;
    }
  }
  
  // Add the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  console.log(`[Chunk HTML] Created ${chunks.length} chunks from ${paragraphs.length} paragraphs`);
  
  return chunks;
}

/**
 * Split text into chunks for translation (plain text fallback)
 * Verbum API has a limit, so we need to chunk large documents
 */
export function chunkText(text: string, maxChunkSize: number = 5000): string[] {
  const chunks: string[] = [];
  
  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the limit
    if (currentChunk.length + paragraph.length > maxChunkSize) {
      // Save current chunk if it has content
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      
      // If the paragraph itself is too long, split it by sentences
      if (paragraph.length > maxChunkSize) {
        const sentences = paragraph.split(/[.!?]+\s+/);
        let sentenceChunk = '';
        
        for (const sentence of sentences) {
          if (sentenceChunk.length + sentence.length > maxChunkSize) {
            if (sentenceChunk.trim()) {
              chunks.push(sentenceChunk.trim());
            }
            sentenceChunk = sentence;
          } else {
            sentenceChunk += (sentenceChunk ? '. ' : '') + sentence;
          }
        }
        
        if (sentenceChunk.trim()) {
          currentChunk = sentenceChunk;
        } else {
          currentChunk = '';
        }
      } else {
        currentChunk = paragraph;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  // Add the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Reconstruct HTML document from translated chunks
 */
export function reconstructHtmlDocument(translatedChunks: string[]): string {
  return translatedChunks.join('');
}

/**
 * Reconstruct document from translated chunks (plain text)
 */
export function reconstructDocument(translatedChunks: string[]): string {
  return translatedChunks.join('\n\n');
}

/**
 * Create a translated document buffer with formatting preservation
 */
export async function createTranslatedDocumentBuffer(
  translatedContent: string,
  originalMimeType: string,
  isHtml: boolean = false,
  originalFileBuffer?: Buffer
): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
  
  // If content is HTML and original was DOCX, convert back to DOCX
  if (isHtml && (originalMimeType.includes('word') || originalMimeType.includes('document'))) {
    console.log('[Create Document] Converting HTML back to DOCX with formatting');
    // Dynamic import to avoid loading docx library at module level
    const { convertHtmlToDocx } = await import('./htmlToDocxConverter');
    const buffer = await convertHtmlToDocx(translatedContent);
    return {
      buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: '.docx',
    };
  }
  
  // Otherwise, output as plain text
  const buffer = Buffer.from(translatedContent, 'utf-8');
  
  // Determine output format based on input
  let mimeType = 'text/plain';
  let extension = '.txt';
  
  if (originalMimeType === 'application/pdf') {
    console.log('[Create Document] Using DeepL API for PDF translation with format preservation');
    
    // Note: For PDFs, we use DeepL's Document Translation API which handles
    // translation directly from the original file, not from extracted text.
    // The translatedContent parameter is ignored for PDFs.
    // This will be handled by the translate route which calls DeepL directly.
    
    // This code path should not be reached for PDFs when using DeepL,
    // but we keep it as a fallback
    if (!originalFileBuffer) {
      throw new Error('Original PDF file buffer is required for format preservation');
    }
    
    // Use format preservation method as fallback
    const { createTranslatedPDFWithFormatPreservation } = await import('./pdfOverlayProcessor');
    
    // Create translated PDF with format preservation
    const buffer = await createTranslatedPDFWithFormatPreservation(
      originalFileBuffer,
      translatedContent
    );
    
    return {
      buffer,
      mimeType: 'application/pdf',
      extension: '.pdf',
    };
  } else if (originalMimeType.includes('word')) {
    // Future: use docx library to create DOCX
    mimeType = 'text/plain';
    extension = '.txt';
  }
  
  return { buffer, mimeType, extension };
}

/**
 * Validate file type
 */
export function isValidFileType(mimeType: string): boolean {
  const validTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
  ];
  
  return validTypes.includes(mimeType);
}

/**
 * Validate file size (max 100MB)
 */
export function isValidFileSize(sizeInBytes: number): boolean {
  const maxSize = 100 * 1024 * 1024; // 100MB
  return sizeInBytes <= maxSize;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
}

/**
 * Sanitize filename to prevent security issues
 */
export function sanitizeFilename(filename: string): string {
  // Remove any path separators and special characters
  return filename
    .replace(/[\/\\]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255); // Limit length
}
