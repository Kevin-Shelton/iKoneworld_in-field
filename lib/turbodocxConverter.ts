/**
 * TurboDocx HTML to DOCX Converter
 * 
 * Uses @turbodocx/html-to-docx for robust HTML → DOCX conversion
 * with comprehensive format preservation (tables, images, lists, headings)
 */

import HTMLtoDOCX from '@turbodocx/html-to-docx';

export interface ConversionOptions {
  orientation?: 'portrait' | 'landscape';
  title?: string;
  creator?: string;
  margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

/**
 * Convert HTML to DOCX with format preservation
 * 
 * @param html - HTML string with formatting
 * @param options - Document options (orientation, title, margins, etc.)
 * @returns Buffer containing DOCX file
 */
export async function convertHtmlToDocx(
  html: string,
  options: ConversionOptions = {}
): Promise<Buffer> {
  console.log('[TurboDocx] Converting HTML to DOCX, HTML length:', html.length);
  console.log('[TurboDocx] Options:', JSON.stringify(options, null, 2));
  
  try {
    // Prepare document options
    const docOptions: any = {
      orientation: options.orientation || 'portrait',
      title: options.title || 'Translated Document',
      creator: options.creator || 'iKoneworld Translation System',
    };
    
    // Add margins if specified (in TWIP units: 1 inch = 1440 TWIP)
    if (options.margins) {
      docOptions.margins = {
        top: options.margins.top || 1440,
        right: options.margins.right || 1800,
        bottom: options.margins.bottom || 1440,
        left: options.margins.left || 1800,
      };
    }
    
    // Convert HTML to DOCX
    console.log('[TurboDocx] Starting conversion with HTMLtoDOCX...');
    const docxArrayBuffer = await HTMLtoDOCX(html, null, docOptions);
    
    // Convert ArrayBuffer to Buffer
    const buffer = Buffer.from(docxArrayBuffer);
    console.log('[TurboDocx] Conversion complete, DOCX size:', buffer.length);
    
    return buffer;
  } catch (error) {
    console.error('[TurboDocx] Conversion error:', error);
    throw new Error(`Failed to convert HTML to DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate HTML before conversion
 * Ensures HTML is well-formed and suitable for conversion
 * 
 * @param html - HTML string to validate
 * @returns true if valid, throws error if invalid
 */
export function validateHtml(html: string): boolean {
  if (!html || typeof html !== 'string') {
    throw new Error('HTML must be a non-empty string');
  }
  
  if (html.trim().length === 0) {
    throw new Error('HTML cannot be empty');
  }
  
  // Check for basic HTML structure
  if (!/<[^>]+>/.test(html)) {
    throw new Error('HTML must contain at least one HTML tag');
  }
  
  return true;
}

/**
 * Wrap plain HTML content in a complete HTML document structure
 * Ensures proper HTML document structure for conversion
 * 
 * @param htmlContent - HTML content (may be fragment or complete document)
 * @returns Complete HTML document string
 */
export function wrapHtmlDocument(htmlContent: string): string {
  // Check if already a complete HTML document
  if (/<html[\s>]/i.test(htmlContent) && /<body[\s>]/i.test(htmlContent)) {
    return htmlContent;
  }
  
  // Wrap in complete HTML structure
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Document</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    table, th, td {
      border: 1px solid #ddd;
    }
    th, td {
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
    }
    img {
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
}
