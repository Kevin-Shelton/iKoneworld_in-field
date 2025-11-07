/**
 * Improved Chunking Processor
 * 
 * Applies best practices from skeleton method to large file processing:
 * - Field code locking (date preservation)
 * - Progress tracking
 * - Structure preservation for DOCX
 * - Better error handling
 */

import { extractDocumentXml, createModifiedDocx } from './docxHandler';
import JSZip from 'jszip';

interface ChunkingOptions {
  fileBuffer: Buffer;
  sourceLanguage: string;
  targetLanguage: string;
  conversationId: number;
  onProgress?: (percentage: number, message: string) => Promise<void>;
}

interface ChunkingResult {
  translatedBuffer: Buffer;
  chunkCount: number;
  processingTimeMs: number;
}

/**
 * Process large DOCX files with structure preservation
 */
export async function processLargeDocx(options: ChunkingOptions): Promise<ChunkingResult> {
  const startTime = Date.now();
  const { fileBuffer, sourceLanguage, targetLanguage, conversationId, onProgress } = options;
  
  try {
    // Step 1: Extract XML structure (5%)
    if (onProgress) await onProgress(5, 'Analyzing document structure...');
    
    const documentXml = await extractDocumentXml(fileBuffer);
    
    // Step 2: Lock field codes to preserve dates (10%)
    if (onProgress) await onProgress(10, 'Preserving document metadata...');
    
    const lockedXml = lockFieldCodes(documentXml);
    
    // Step 3: Extract text nodes (15%)
    if (onProgress) await onProgress(15, 'Reading content...');
    
    const textNodes = extractTextNodes(lockedXml);
    console.log(`[Chunking] Extracted ${textNodes.length} text nodes`);
    
    // Step 4: Chunk text nodes (20%)
    if (onProgress) await onProgress(20, 'Preparing for translation...');
    
    const chunks = chunkTextNodes(textNodes, 50); // 50 nodes per chunk
    console.log(`[Chunking] Created ${chunks.length} chunks`);
    
    // Step 5: Translate chunks with progress (20-80%)
    if (onProgress) await onProgress(25, 'Translating your content...');
    
    const translatedNodes: string[] = [];
    const progressIncrement = 55 / chunks.length; // 55% total for translation (20-75%)
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkText = chunk.join('\n');
      
      // Translate chunk via Verbum API
      const response = await fetch(
        'https://sdk.verbum.ai/v1/translator/translate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.VERBUM_API_KEY!,
          },
          body: JSON.stringify({
            text: [{ text: chunkText }],
            from: sourceLanguage,
            to: [targetLanguage],
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`Translation failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      const translatedText = data.translations?.[0]?.text || chunkText;
      
      // Split back into individual nodes
      const translatedChunk = translatedText.split('\n');
      translatedNodes.push(...translatedChunk);
      
      // Update progress
      const currentProgress = 25 + Math.floor((i + 1) * progressIncrement);
      if (onProgress) {
        await onProgress(
          currentProgress,
          `Translating your content... (${i + 1}/${chunks.length} sections)`
        );
      }
    }
    
    // Step 6: Replace text nodes in XML (80%)
    if (onProgress) await onProgress(80, 'Rebuilding document layout...');
    
    let modifiedXml = lockedXml;
    textNodes.forEach((originalText, index) => {
      if (translatedNodes[index]) {
        modifiedXml = modifiedXml.replace(originalText, translatedNodes[index]);
      }
    });
    
    // Step 7: Create modified DOCX (90%)
    if (onProgress) await onProgress(90, 'Finalizing your document...');
    
    // Load original DOCX and replace document.xml
    const zip = await JSZip.loadAsync(fileBuffer);
    zip.file('word/document.xml', modifiedXml);
    const translatedBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });
    
    // Step 8: Complete (100%)
    if (onProgress) await onProgress(100, 'Translation complete!');
    
    const processingTimeMs = Date.now() - startTime;
    
    return {
      translatedBuffer,
      chunkCount: chunks.length,
      processingTimeMs,
    };
    
  } catch (error) {
    console.error('[Chunking] Error processing large DOCX:', error);
    throw error;
  }
}

/**
 * Lock field codes to prevent Word from recalculating them
 * (Copied from skeleton method)
 */
function lockFieldCodes(xml: string): string {
  // Find all field codes (e.g., DATE, TIME, PAGE)
  const fieldPattern = /<w:fldChar w:fldCharType="begin"[^>]*\/>([\s\S]*?)<w:fldChar w:fldCharType="end"[^>]*\/>/g;
  
  return xml.replace(fieldPattern, (match, fieldContent) => {
    // Extract the field result (the cached value)
    const resultMatch = fieldContent.match(/<w:fldChar w:fldCharType="separate"[^>]*\/>([\s\S]*?)$/);
    
    if (resultMatch) {
      // Return only the result text, removing the field instruction
      return resultMatch[1];
    }
    
    return match;
  });
}

/**
 * Extract text nodes from XML
 */
function extractTextNodes(xml: string): string[] {
  const textNodes: string[] = [];
  const textPattern = /<w:t[^>]*>([^<]+)<\/w:t>/g;
  
  let match;
  while ((match = textPattern.exec(xml)) !== null) {
    const text = match[1];
    if (text && text.trim().length > 0) {
      textNodes.push(text);
    }
  }
  
  return textNodes;
}

/**
 * Chunk text nodes into groups for translation
 */
function chunkTextNodes(nodes: string[], nodesPerChunk: number): string[][] {
  const chunks: string[][] = [];
  
  for (let i = 0; i < nodes.length; i += nodesPerChunk) {
    chunks.push(nodes.slice(i, i + nodesPerChunk));
  }
  
  return chunks;
}

/**
 * Process large PDF files (text extraction only)
 */
export async function processLargePdf(options: ChunkingOptions): Promise<ChunkingResult> {
  const startTime = Date.now();
  const { fileBuffer, sourceLanguage, targetLanguage, onProgress } = options;
  
  try {
    // Step 1: Extract text (10%)
    if (onProgress) await onProgress(10, 'Reading PDF content...');
    
    const { extractTextFromDocument } = await import('./documentUtils');
    const extractedText = await extractTextFromDocument(fileBuffer, 'application/pdf');
    
    // Step 2: Chunk text (20%)
    if (onProgress) await onProgress(20, 'Preparing for translation...');
    
    const { chunkText } = await import('./documentUtils');
    const chunks = chunkText(extractedText, 5000);
    console.log(`[Chunking] Created ${chunks.length} text chunks`);
    
    // Step 3: Translate chunks (20-90%)
    if (onProgress) await onProgress(25, 'Translating your content...');
    
    const translatedChunks: string[] = [];
    const progressIncrement = 65 / chunks.length;
    
    for (let i = 0; i < chunks.length; i++) {
      // Translate chunk via Verbum API
      const response = await fetch(
        'https://sdk.verbum.ai/v1/translator/translate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.VERBUM_API_KEY!,
          },
          body: JSON.stringify({
            text: [{ text: chunks[i] }],
            from: sourceLanguage,
            to: [targetLanguage],
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`Translation failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      const translatedChunk = data.translations?.[0]?.text || chunks[i];
      
      translatedChunks.push(translatedChunk);
      
      const currentProgress = 25 + Math.floor((i + 1) * progressIncrement);
      if (onProgress) {
        await onProgress(
          currentProgress,
          `Translating your content... (${i + 1}/${chunks.length} sections)`
        );
      }
    }
    
    // Step 4: Combine translated text (90%)
    if (onProgress) await onProgress(90, 'Finalizing your document...');
    
    const translatedText = translatedChunks.join('\n\n');
    const translatedBuffer = Buffer.from(translatedText, 'utf-8');
    
    // Step 5: Complete (100%)
    if (onProgress) await onProgress(100, 'Translation complete!');
    
    const processingTimeMs = Date.now() - startTime;
    
    return {
      translatedBuffer,
      chunkCount: chunks.length,
      processingTimeMs,
    };
    
  } catch (error) {
    console.error('[Chunking] Error processing large PDF:', error);
    throw error;
  }
}
