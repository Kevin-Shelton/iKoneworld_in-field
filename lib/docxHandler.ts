/**
 * DOCX Handler
 * 
 * Utilities for working with DOCX files as ZIP archives
 * Handles extraction and modification of document.xml
 */

import JSZip from 'jszip';

/**
 * Extract document.xml from a DOCX file
 * 
 * @param buffer - The DOCX file buffer
 * @returns The content of word/document.xml as string
 * @throws Error if file is not a valid DOCX or document.xml is missing
 */
export async function extractDocumentXml(buffer: Buffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    
    // Check if word/document.xml exists
    const documentXml = zip.file('word/document.xml');
    
    if (!documentXml) {
      throw new Error('Invalid DOCX file: word/document.xml not found');
    }
    
    // Extract as text
    const content = await documentXml.async('text');
    return content;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to extract document.xml: ${error.message}`);
    }
    throw new Error('Failed to extract document.xml: Unknown error');
  }
}

/**
 * Create a new DOCX file with modified document.xml
 * 
 * @param originalBuffer - The original DOCX file buffer
 * @param newDocumentXml - The modified document.xml content
 * @returns Buffer of the new DOCX file
 * @throws Error if ZIP operations fail
 */
export async function createModifiedDocx(
  originalBuffer: Buffer,
  newDocumentXml: string
): Promise<Buffer> {
  try {
    // Load original DOCX
    const zip = await JSZip.loadAsync(originalBuffer);
    
    // Replace document.xml with new content
    zip.file('word/document.xml', newDocumentXml);
    
    // Generate new DOCX buffer
    const newBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9, // Maximum compression
      },
    });
    
    return newBuffer;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create modified DOCX: ${error.message}`);
    }
    throw new Error('Failed to create modified DOCX: Unknown error');
  }
}

/**
 * Extract metadata from DOCX file
 * 
 * @param buffer - The DOCX file buffer
 * @returns Metadata object
 */
export async function extractDocxMetadata(buffer: Buffer): Promise<{
  hasDocumentXml: boolean;
  hasStyles: boolean;
  hasNumbering: boolean;
  fileCount: number;
}> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    
    return {
      hasDocumentXml: zip.file('word/document.xml') !== null,
      hasStyles: zip.file('word/styles.xml') !== null,
      hasNumbering: zip.file('word/numbering.xml') !== null,
      fileCount: Object.keys(zip.files).length,
    };
  } catch {
    return {
      hasDocumentXml: false,
      hasStyles: false,
      hasNumbering: false,
      fileCount: 0,
    };
  }
}

/**
 * Validate DOCX structure
 * 
 * @param buffer - The DOCX file buffer
 * @returns Validation result with details
 */
export async function validateDocxStructure(buffer: Buffer): Promise<{
  isValid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  
  try {
    const zip = await JSZip.loadAsync(buffer);
    
    // Check for required files
    if (!zip.file('word/document.xml')) {
      errors.push('Missing word/document.xml');
    }
    
    if (!zip.file('[Content_Types].xml')) {
      errors.push('Missing [Content_Types].xml');
    }
    
    if (!zip.file('_rels/.rels')) {
      errors.push('Missing _rels/.rels');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  } catch (error) {
    errors.push(`Failed to parse ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      isValid: false,
      errors,
    };
  }
}
