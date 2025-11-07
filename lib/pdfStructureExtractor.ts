/**
 * PDF Structure Extractor
 * 
 * Extracts text from PDFs while preserving structure information
 * like paragraphs, headings, and layout using pdf2json metadata
 */

export interface PDFTextBlock {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontName: string;
  isHeading: boolean;
  isParagraphStart: boolean;
}

export interface PDFStructure {
  blocks: PDFTextBlock[];
  formattedText: string;
}

/**
 * Extract structured text from PDF using pdf2json
 * Preserves paragraphs, headings, and basic layout
 */
export async function extractPDFStructure(fileBuffer: Buffer): Promise<PDFStructure> {
  const PDFParser = require('pdf2json');
  
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    const blocks: PDFTextBlock[] = [];
    
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(new Error(`PDF parsing error: ${errData.parserError}`));
    });
    
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        if (!pdfData.Pages || !Array.isArray(pdfData.Pages)) {
          reject(new Error('Invalid PDF structure'));
          return;
        }
        
        // Extract all text blocks with their metadata
        pdfData.Pages.forEach((page: any, pageIndex: number) => {
          if (!page.Texts || !Array.isArray(page.Texts)) return;
          
          page.Texts.forEach((textItem: any) => {
            if (!textItem.R || !Array.isArray(textItem.R)) return;
            
            const x = textItem.x || 0;
            const y = textItem.y || 0;
            
            textItem.R.forEach((run: any) => {
              const text = decodeURIComponent(run.T || '').trim();
              if (!text) return;
              
              const fontSize = run.TS?.[1] || 12; // Font size
              const fontName = run.TS?.[0] || 'default'; // Font name
              
              blocks.push({
                text,
                x,
                y,
                fontSize,
                fontName,
                isHeading: false, // Will be determined later
                isParagraphStart: false // Will be determined later
              });
            });
          });
        });
        
        // Sort blocks by position (top to bottom, left to right)
        blocks.sort((a, b) => {
          const yDiff = a.y - b.y;
          if (Math.abs(yDiff) > 0.5) return yDiff;
          return a.x - b.x;
        });
        
        // Analyze structure to identify headings and paragraphs
        analyzeStructure(blocks);
        
        // Generate formatted text with preserved structure
        const formattedText = generateFormattedText(blocks);
        
        resolve({
          blocks,
          formattedText
        });
      } catch (error) {
        reject(new Error(`Failed to extract PDF structure: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
    
    // Parse the PDF buffer with timeout
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
 * Analyze blocks to identify headings and paragraph boundaries
 */
function analyzeStructure(blocks: PDFTextBlock[]): void {
  if (blocks.length === 0) return;
  
  // Calculate average font size
  const avgFontSize = blocks.reduce((sum, b) => sum + b.fontSize, 0) / blocks.length;
  
  // Mark headings (larger than average font size)
  blocks.forEach((block, index) => {
    // Heading detection: significantly larger font or bold
    block.isHeading = block.fontSize > avgFontSize * 1.2;
    
    // Paragraph detection: significant vertical gap from previous block
    if (index > 0) {
      const prevBlock = blocks[index - 1];
      const verticalGap = block.y - prevBlock.y;
      
      // New paragraph if:
      // 1. Vertical gap is larger than normal line spacing (> 1.5x font size)
      // 2. Previous block was a heading
      // 3. Significant horizontal position change (new column or indentation)
      const isNewParagraph = 
        verticalGap > prevBlock.fontSize * 1.5 ||
        prevBlock.isHeading ||
        Math.abs(block.x - prevBlock.x) > 2;
      
      block.isParagraphStart = isNewParagraph;
    } else {
      block.isParagraphStart = true; // First block
    }
  });
}

/**
 * Generate formatted text with preserved structure
 */
function generateFormattedText(blocks: PDFTextBlock[]): string {
  const lines: string[] = [];
  let currentLine = '';
  
  blocks.forEach((block, index) => {
    // Add paragraph break before headings or new paragraphs
    if (block.isParagraphStart && currentLine) {
      lines.push(currentLine.trim());
      lines.push(''); // Empty line for paragraph break
      currentLine = '';
    }
    
    // Add heading marker (for reconstruction later)
    if (block.isHeading) {
      if (currentLine) {
        lines.push(currentLine.trim());
        currentLine = '';
      }
      lines.push(`## ${block.text}`); // Use markdown-style heading
      lines.push(''); // Empty line after heading
    } else {
      // Add space between words on the same line
      if (currentLine && !currentLine.endsWith(' ')) {
        currentLine += ' ';
      }
      currentLine += block.text;
    }
  });
  
  // Add final line
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }
  
  return lines.join('\n');
}

/**
 * Reconstruct PDF with translated text preserving structure
 */
export async function reconstructPDFWithStructure(
  translatedText: string,
  originalStructure: PDFStructure
): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  
  // Import sanitizer
  const { sanitizeForPDF } = await import('./pdfTextSanitizer');
  
  // Sanitize translated text
  const sanitizedText = sanitizeForPDF(translatedText);
  
  // Create new PDF
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Parse translated text back into structured format
  const lines = sanitizedText.split('\n');
  
  let currentPage = pdfDoc.addPage();
  let { width, height } = currentPage.getSize();
  const margin = 50;
  const maxWidth = width - (2 * margin);
  let yPosition = height - margin;
  
  const normalFontSize = 12;
  const headingFontSize = 16;
  const lineSpacing = 1.5;
  
  for (const line of lines) {
    // Skip empty lines but add spacing
    if (!line.trim()) {
      yPosition -= normalFontSize * lineSpacing;
      continue;
    }
    
    // Check if this is a heading
    const isHeading = line.startsWith('## ');
    const text = isHeading ? line.substring(3) : line;
    const fontSize = isHeading ? headingFontSize : normalFontSize;
    const currentFont = isHeading ? boldFont : font;
    
    // Word wrap
    const words = text.split(' ');
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = currentFont.widthOfTextAtSize(testLine, fontSize);
      
      if (textWidth > maxWidth && currentLine) {
        // Draw current line
        if (yPosition < margin + fontSize) {
          currentPage = pdfDoc.addPage();
          yPosition = height - margin;
        }
        
        currentPage.drawText(currentLine, {
          x: margin,
          y: yPosition,
          size: fontSize,
          font: currentFont,
          color: rgb(0, 0, 0)
        });
        
        yPosition -= fontSize * lineSpacing;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    // Draw remaining text
    if (currentLine) {
      if (yPosition < margin + fontSize) {
        currentPage = pdfDoc.addPage();
        yPosition = height - margin;
      }
      
      currentPage.drawText(currentLine, {
        x: margin,
        y: yPosition,
        size: fontSize,
        font: currentFont,
        color: rgb(0, 0, 0)
      });
      
      yPosition -= fontSize * lineSpacing;
    }
    
    // Extra spacing after headings
    if (isHeading) {
      yPosition -= fontSize * 0.5;
    }
  }
  
  return Buffer.from(await pdfDoc.save());
}
