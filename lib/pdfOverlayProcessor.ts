/**
 * PDF Overlay Processor
 * 
 * Preserves complete PDF formatting (images, colors, fonts, layout) by:
 * 1. Copying original PDF pages (preserves all visuals)
 * 2. Extracting text positions with pdf2json
 * 3. Overlaying translated text on top of original
 * 
 * This approach is similar to how professional tools like Adobe Acrobat
 * and Smartcat handle PDF translation with format preservation.
 */

import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { sanitizeForPDF } from './pdfTextSanitizer';

export interface TextPosition {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  pageIndex: number;
}

export interface TranslationMapping {
  original: string;
  translated: string;
  positions: TextPosition[];
}

/**
 * Extract text with precise positions from PDF
 * Returns text grouped by position for overlay
 */
export async function extractTextWithPositions(fileBuffer: Buffer): Promise<TextPosition[]> {
  const PDFParser = require('pdf2json');
  
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    const positions: TextPosition[] = [];
    
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(new Error(`PDF parsing error: ${errData.parserError}`));
    });
    
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        if (!pdfData.Pages || !Array.isArray(pdfData.Pages)) {
          reject(new Error('Invalid PDF structure'));
          return;
        }
        
        // Extract text with positions from each page
        pdfData.Pages.forEach((page: any, pageIndex: number) => {
          if (!page.Texts || !Array.isArray(page.Texts)) return;
          
          const pageHeight = page.Height || 11; // Default letter size
          
          page.Texts.forEach((textItem: any) => {
            if (!textItem.R || !Array.isArray(textItem.R)) return;
            
            const x = textItem.x || 0;
            const y = textItem.y || 0;
            
            textItem.R.forEach((run: any) => {
              const text = decodeURIComponent(run.T || '').trim();
              if (!text) return;
              
              const fontSize = run.TS?.[1] || 12;
              const fontWidth = run.TS?.[2] || 0;
              
              // Estimate text width (rough approximation)
              const width = text.length * fontSize * 0.5;
              const height = fontSize * 1.2;
              
              // Convert PDF coordinates (origin at bottom-left) to pdf-lib coordinates
              // pdf2json uses normalized coordinates (0-1 range multiplied by page dimensions)
              positions.push({
                text,
                x: x * 72, // Convert to points (72 points per inch)
                y: (pageHeight - y) * 72, // Flip Y coordinate
                width,
                height,
                fontSize,
                pageIndex
              });
            });
          });
        });
        
        resolve(positions);
      } catch (error) {
        reject(new Error(`Failed to extract text positions: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
    
    // Parse with timeout
    const timeout = setTimeout(() => {
      reject(new Error('PDF parsing timeout after 30 seconds'));
    }, 30000);
    
    pdfParser.parseBuffer(fileBuffer);
    
    pdfParser.on('pdfParser_dataReady', () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * Create translation mapping from original and translated text
 * Matches translated chunks back to their original positions
 */
export function createTranslationMapping(
  originalText: string,
  translatedText: string,
  positions: TextPosition[]
): TranslationMapping[] {
  const mappings: TranslationMapping[] = [];
  
  // Simple approach: assume text order is preserved
  // Split both texts into words and map them
  const originalWords = originalText.split(/\s+/);
  const translatedWords = translatedText.split(/\s+/);
  
  // Group positions by proximity (same line/paragraph)
  const groupedPositions: TextPosition[][] = [];
  let currentGroup: TextPosition[] = [];
  let lastY = -1;
  
  positions.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 5) return yDiff;
    return a.x - b.x;
  });
  
  positions.forEach(pos => {
    if (lastY === -1 || Math.abs(pos.y - lastY) < pos.height) {
      currentGroup.push(pos);
    } else {
      if (currentGroup.length > 0) {
        groupedPositions.push([...currentGroup]);
      }
      currentGroup = [pos];
    }
    lastY = pos.y;
  });
  
  if (currentGroup.length > 0) {
    groupedPositions.push(currentGroup);
  }
  
  // Create mappings for each group
  let wordIndex = 0;
  groupedPositions.forEach(group => {
    const originalGroupText = group.map(p => p.text).join(' ');
    const wordCount = originalGroupText.split(/\s+/).length;
    
    // Get corresponding translated words
    const translatedGroupWords = translatedWords.slice(wordIndex, wordIndex + wordCount);
    const translatedGroupText = translatedGroupWords.join(' ');
    
    mappings.push({
      original: originalGroupText,
      translated: translatedGroupText,
      positions: group
    });
    
    wordIndex += wordCount;
  });
  
  return mappings;
}

/**
 * Create translated PDF with complete format preservation
 * Uses overlay approach: copies original pages, then overlays translated text
 */
export async function createTranslatedPDFWithOverlay(
  originalPdfBuffer: Buffer,
  translatedText: string,
  textPositions: TextPosition[]
): Promise<Buffer> {
  // Load original PDF
  const originalPdf = await PDFDocument.load(originalPdfBuffer);
  
  // Create new PDF and copy all pages (preserves images, colors, backgrounds)
  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(originalPdf, originalPdf.getPageIndices());
  
  // Add all copied pages
  copiedPages.forEach(page => {
    newPdf.addPage(page);
  });
  
  // Embed fonts for translated text
  const font = await newPdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await newPdf.embedFont(StandardFonts.HelveticaBold);
  
  // Sanitize translated text
  const sanitizedText = sanitizeForPDF(translatedText);
  
  // Create translation mapping
  const originalText = textPositions.map(p => p.text).join(' ');
  const mappings = createTranslationMapping(originalText, sanitizedText, textPositions);
  
  // Overlay translated text on each page
  const pages = newPdf.getPages();
  
  mappings.forEach(mapping => {
    if (mapping.positions.length === 0) return;
    
    const pageIndex = mapping.positions[0].pageIndex;
    if (pageIndex >= pages.length) return;
    
    const page = pages[pageIndex];
    const { height: pageHeight } = page.getSize();
    
    // Calculate bounding box for this text group
    const minX = Math.min(...mapping.positions.map(p => p.x));
    const maxX = Math.max(...mapping.positions.map(p => p.x + p.width));
    const minY = Math.min(...mapping.positions.map(p => p.y));
    const maxY = Math.max(...mapping.positions.map(p => p.y + p.height));
    
    const boxWidth = maxX - minX;
    const boxHeight = maxY - minY;
    
    // Draw white rectangle to hide original text
    page.drawRectangle({
      x: minX - 2,
      y: pageHeight - maxY - 2,
      width: boxWidth + 4,
      height: boxHeight + 4,
      color: rgb(1, 1, 1), // White
      opacity: 1
    });
    
    // Calculate appropriate font size for translated text
    const avgFontSize = mapping.positions.reduce((sum, p) => sum + p.fontSize, 0) / mapping.positions.length;
    let fontSize = avgFontSize;
    
    // Adjust font size if translated text is longer
    const originalLength = mapping.original.length;
    const translatedLength = mapping.translated.length;
    
    if (translatedLength > originalLength) {
      fontSize = fontSize * (originalLength / translatedLength);
      fontSize = Math.max(fontSize, 8); // Minimum readable size
    }
    
    // Draw translated text
    const textWidth = font.widthOfTextAtSize(mapping.translated, fontSize);
    
    if (textWidth <= boxWidth) {
      // Text fits, draw it
      page.drawText(mapping.translated, {
        x: minX,
        y: pageHeight - maxY + (boxHeight - fontSize) / 2,
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0)
      });
    } else {
      // Text doesn't fit, wrap it
      const words = mapping.translated.split(' ');
      let currentLine = '';
      let yOffset = 0;
      const lineHeight = fontSize * 1.2;
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        
        if (testWidth > boxWidth && currentLine) {
          // Draw current line
          page.drawText(currentLine, {
            x: minX,
            y: pageHeight - maxY + (boxHeight - fontSize) / 2 - yOffset,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0)
          });
          
          yOffset += lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      // Draw last line
      if (currentLine) {
        page.drawText(currentLine, {
          x: minX,
          y: pageHeight - maxY + (boxHeight - fontSize) / 2 - yOffset,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0)
        });
      }
    }
  });
  
  // Save and return
  const pdfBytes = await newPdf.save();
  return Buffer.from(pdfBytes);
}
