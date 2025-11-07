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
 * Validate file size (max 100MB)
 * 
 * Rationale for 100MB limit:
 * - Supabase Pro: 5GB per file (plenty of room)
 * - Vercel Pro: 300s timeout (5 minutes)
 * - Translation processing: ~1 second per 10KB
 * - User experience: 100MB ≈ 1000 pages (large enterprise documents)
 * - Processing time: 100MB ≈ 15-20 minutes (acceptable for large files)
 * 
 * Note: Requires Pro plans (Supabase Pro + Vercel Pro) for optimal performance
 */
export function isValidFileSize(sizeInBytes: number): boolean {
  const maxSize = 100 * 1024 * 1024; // 100MB
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
        // Use pdf2json which is truly serverless-compatible (no canvas/DOM dependencies)
        const PDFParser = require('pdf2json');
        
        // Add timeout protection for PDF parsing (30 seconds max)
        const pdfPromise = new Promise<string>((resolve, reject) => {
          const pdfParser = new PDFParser();
          
          pdfParser.on('pdfParser_dataError', (errData: any) => {
            reject(new Error(`PDF parsing error: ${errData.parserError}`));
          });
          
          pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
            try {
              // Extract text from all pages
              const textContent: string[] = [];
              
              if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
                pdfData.Pages.forEach((page: any) => {
                  if (page.Texts && Array.isArray(page.Texts)) {
                    const pageText = page.Texts
                      .map((text: any) => {
                        if (text.R && Array.isArray(text.R)) {
                          return text.R
                            .map((r: any) => decodeURIComponent(r.T || ''))
                            .join(' ');
                        }
                        return '';
                      })
                      .filter((t: string) => t.trim().length > 0)
                      .join(' ');
                    
                    if (pageText.trim()) {
                      textContent.push(pageText);
                    }
                  }
                });
              }
              
              const fullText = textContent.join('\n\n');
              resolve(fullText);
            } catch (error) {
              reject(new Error(`Failed to extract text from PDF data: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
          });
          
          // Parse the PDF buffer
          pdfParser.parseBuffer(fileBuffer);
        });
        
        const timeoutPromise = new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error('PDF parsing timeout after 30 seconds')), 30000);
        });
        
        const extractedText = await Promise.race([pdfPromise, timeoutPromise]);
        
        if (!extractedText || typeof extractedText !== 'string' || extractedText.trim().length === 0) {
          throw new Error('PDF parsing returned empty result');
        }
        
        return extractedText;
      
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
