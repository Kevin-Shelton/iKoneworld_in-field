import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

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
 * Extract text from PDF
 */
async function extractTextFromPDF(fileBuffer: Buffer): Promise<string> {
  const data = await pdfParse(fileBuffer);
  return data.text;
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
 * Split text into chunks for translation
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
 * Reconstruct document from translated chunks
 */
export function reconstructDocument(translatedChunks: string[]): string {
  return translatedChunks.join('\n\n');
}

/**
 * Create a translated document buffer (for now, just text file)
 * In the future, we can add support for maintaining original formatting
 */
export function createTranslatedDocumentBuffer(
  translatedText: string,
  originalMimeType: string
): { buffer: Buffer; mimeType: string; extension: string } {
  // For now, we'll output as text file
  // Future enhancement: maintain original format
  const buffer = Buffer.from(translatedText, 'utf-8');
  
  // Determine output format based on input
  let mimeType = 'text/plain';
  let extension = '.txt';
  
  if (originalMimeType === 'application/pdf') {
    // Future: use pdf-lib to create PDF
    mimeType = 'text/plain';
    extension = '.txt';
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
