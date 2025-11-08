/**
 * TurboDocx HTML to DOCX Converter
 * 
 * Uses @turbodocx/html-to-docx for robust HTML → DOCX conversion
 * with comprehensive format preservation (tables, images, lists, headings)
 */

import * as HTMLtoDOCXModule from '@turbodocx/html-to-docx';
const HTMLtoDOCX = (HTMLtoDOCXModule as any).default || HTMLtoDOCXModule;

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
 * Normalize table HTML for TurboDocx compatibility
 * Adds explicit colspan and rowspan attributes to all table cells
 * 
 * @param html - HTML string potentially containing tables
 * @returns HTML with normalized table attributes
 */
function normalizeTableHtml(html: string): string {
  // Add colspan="1" and rowspan="1" to td/th tags that don't have them
  return html.replace(/<(td|th)([^>]*)>/gi, (match, tag, attrs) => {
    // Check if colspan already exists
    const hasColspan = /colspan\s*=\s*["']?\d+["']?/i.test(attrs);
    // Check if rowspan already exists
    const hasRowspan = /rowspan\s*=\s*["']?\d+["']?/i.test(attrs);
    
    // Build new attributes
    let newAttrs = attrs;
    if (!hasColspan) {
      newAttrs += ' colspan="1"';
    }
    if (!hasRowspan) {
      newAttrs += ' rowspan="1"';
    }
    
    return `<${tag}${newAttrs}>`;
  });
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
    // Log table structures for debugging
    const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi);
    if (tableMatches) {
      console.log('[TurboDocx] Found', tableMatches.length, 'tables');
      tableMatches.forEach((table, index) => {
        console.log(`[TurboDocx] Table ${index + 1} HTML:`, table.substring(0, 500));
      });
    }
    
    // Normalize table HTML for TurboDocx compatibility
    const normalizedHtml = normalizeTableHtml(html);
    console.log('[TurboDocx] Normalized HTML, new length:', normalizedHtml.length);
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
    const docxArrayBuffer = await HTMLtoDOCX(normalizedHtml, null, docOptions);
    
    // Convert ArrayBuffer to Buffer
    // HTMLtoDOCX returns ArrayBuffer | Buffer | Blob, need to handle all cases
    let buffer: Buffer;
    if (Buffer.isBuffer(docxArrayBuffer)) {
      buffer = docxArrayBuffer;
    } else if (docxArrayBuffer instanceof ArrayBuffer) {
      buffer = Buffer.from(new Uint8Array(docxArrayBuffer));
    } else {
      // Blob case - convert to ArrayBuffer first
      const arrayBuffer = await (docxArrayBuffer as Blob).arrayBuffer();
      buffer = Buffer.from(new Uint8Array(arrayBuffer));
    }
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
