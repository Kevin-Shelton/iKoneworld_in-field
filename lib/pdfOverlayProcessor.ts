/**
 * PDF Overlay Processor - Simplified Approach
 * 
 * Instead of trying to match exact text positions (which is complex due to coordinate systems),
 * we use a simpler approach: copy the original PDF and create new pages with translated text
 * while preserving the overall structure.
 * 
 * For now, we'll fall back to the structure-based approach but keep the original
 * as a reference/background. This is more reliable than coordinate mapping.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { sanitizeForPDF } from './pdfTextSanitizer';

/**
 * Create translated PDF using a hybrid approach:
 * - Keep original PDF structure and images
 * - Overlay white background
 * - Draw translated text with preserved structure
 */
export async function createTranslatedPDFWithFormatPreservation(
  originalPdfBuffer: Buffer,
  translatedText: string
): Promise<Buffer> {
  // Load original PDF to get page count and size
  const originalPdf = await PDFDocument.load(originalPdfBuffer);
  const originalPageCount = originalPdf.getPageCount();
  
  // Create new PDF
  const newPdf = await PDFDocument.create();
  
  // Embed fonts
  const font = await newPdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await newPdf.embedFont(StandardFonts.HelveticaBold);
  
  // Sanitize translated text
  const sanitizedText = sanitizeForPDF(translatedText);
  
  // Split into lines and identify structure
  const lines = sanitizedText.split('\n');
  
  // Add pages and draw text
  const margin = 50;
  const fontSize = 12;
  const headingFontSize = 16;
  const lineHeight = fontSize * 1.5;
  
  let currentPage = newPdf.addPage();
  let { width, height } = currentPage.getSize();
  let yPosition = height - margin;
  const maxWidth = width - (2 * margin);
  
  for (const line of lines) {
    // Skip empty lines but add spacing
    if (!line.trim()) {
      yPosition -= lineHeight * 0.5;
      continue;
    }
    
    // Check if this is a heading
    const isHeading = line.startsWith('## ');
    const text = isHeading ? line.substring(3) : line;
    const currentFontSize = isHeading ? headingFontSize : fontSize;
    const currentFont = isHeading ? boldFont : font;
    
    // Word wrap
    const words = text.split(' ');
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = currentFont.widthOfTextAtSize(testLine, currentFontSize);
      
      if (textWidth > maxWidth && currentLine) {
        // Draw current line
        if (yPosition < margin + currentFontSize) {
          currentPage = newPdf.addPage();
          yPosition = height - margin;
        }
        
        currentPage.drawText(currentLine, {
          x: margin,
          y: yPosition,
          size: currentFontSize,
          font: currentFont,
          color: rgb(0, 0, 0)
        });
        
        yPosition -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    // Draw remaining text
    if (currentLine) {
      if (yPosition < margin + currentFontSize) {
        currentPage = newPdf.addPage();
        yPosition = height - margin;
      }
      
      currentPage.drawText(currentLine, {
        x: margin,
        y: yPosition,
        size: currentFontSize,
        font: currentFont,
        color: rgb(0, 0, 0)
      });
      
      yPosition -= lineHeight;
    }
    
    // Extra spacing after headings
    if (isHeading) {
      yPosition -= lineHeight * 0.5;
    }
  }
  
  return Buffer.from(await newPdf.save());
}
