/**
 * Document Utilities - Lightweight version without mammoth dependency
 * 
 * This module contains utility functions that don't require heavy dependencies
 * like mammoth or pdf-parse. Use this for skeleton method to avoid loading
 * @xmldom/xmldom in serverless environments.
 */

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
 * Validate file type
 * 
 * Supported formats:
 * - DOCX: Full structure preservation with field locking
 * - PDF: Text extraction only (no formatting preservation)
 * - TXT: Plain text translation
 * 
 * Deprecated:
 * - DOC: Legacy format removed due to unreliable parsing
 */
export function isValidFileType(mimeType: string): boolean {
  const validTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'text/plain',
  ];
  
  return validTypes.includes(mimeType);
}

/**
 * Validate file size (max 25MB)
 * 
 * Rationale for 25MB limit:
 * - Vercel serverless timeout: 60s (Hobby), 300s (Pro)
 * - Supabase free tier: 50MB per file
 * - Translation API limits: Large files require many chunks
 * - User experience: 25MB ≈ 250 pages (reasonable business document)
 * - Processing time: 25MB ≈ 5-10 minutes (acceptable)
 */
export function isValidFileSize(sizeInBytes: number): boolean {
  const maxSize = 25 * 1024 * 1024; // 25MB
  return sizeInBytes <= maxSize;
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

/**
 * Extract text from plain text buffer
 */
export function extractTextFromTXT(fileBuffer: Buffer): string {
  return fileBuffer.toString('utf-8');
}

/**
 * Extract text from a document based on file type
 * 
 * Note: For DOCX files in the chunking method, this will use mammoth.
 * For skeleton method, we don't call this function - we extract XML directly.
 */
export async function extractTextFromDocument(
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  try {
    switch (mimeType) {
      case 'application/pdf':
        // Lazy load pdf-parse only when needed
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(fileBuffer);
        return pdfData.text;
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        // Lazy load mammoth only when needed (chunking method)
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        return result.value;
      
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
