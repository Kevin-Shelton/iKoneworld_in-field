/**
 * DOCX Formatting Processor
 * 
 * Paragraph-level DOCX processing that preserves formatting during translation.
 * Uses dynamic imports to avoid DOMMatrix errors in serverless environments.
 */

export interface TextRun {
  text?: string;  // Optional for image-only runs
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  font?: string;
  size?: number;
  // Image support
  image?: {
    data: Buffer;  // Image binary data
    width: number;  // Width in EMUs (English Metric Units)
    height: number; // Height in EMUs
    type: string;   // MIME type (image/png, image/jpeg, etc.)
    name?: string;  // Original filename
  };
}

export interface FormattedParagraph {
  runs: TextRun[];
  heading?: 'HEADING_1' | 'HEADING_2' | 'HEADING_3' | 'HEADING_4' | 'HEADING_5' | 'HEADING_6';
  alignment?: 'left' | 'center' | 'right' | 'justify';
  spacing?: {
    before?: number;  // Space before paragraph (in twips)
    after?: number;   // Space after paragraph (in twips)
    line?: number;    // Line spacing (in twips or percentage)
    lineRule?: 'atLeast' | 'exactly' | 'auto'; // Line spacing rule
  };
  indent?: {
    left?: number;    // Left indent (in twips)
    right?: number;   // Right indent (in twips)
    firstLine?: number; // First line indent (in twips)
  };
}

export interface DocxStructure {
  paragraphs: FormattedParagraph[];
  media?: Map<string, Buffer>; // Map of relationship ID to image data
}

/**
 * Parse DOCX file and extract paragraphs with formatting metadata
 * 
 * @param buffer - DOCX file buffer
 * @returns Structured paragraphs with formatting
 */
export async function parseDocxStructure(buffer: Buffer): Promise<DocxStructure> {
  // Dynamic import to avoid DOMMatrix errors
  const JSZip = (await import('jszip')).default;
  const { DOMParser } = await import('@xmldom/xmldom');
  
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  
  if (!documentXml) {
    throw new Error('Invalid DOCX file: document.xml not found');
  }
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(documentXml, 'text/xml');
  
  const paragraphs: FormattedParagraph[] = [];
  const paragraphNodes = doc.getElementsByTagName('w:p');
  
  for (let i = 0; i < paragraphNodes.length; i++) {
    const pNode = paragraphNodes[i];
    const paragraph = parseParagraph(pNode);
    
    // Skip empty paragraphs
    if (paragraph.runs.length > 0 && paragraph.runs.some(r => r.text?.trim())) {
      paragraphs.push(paragraph);
    }
  }
  
  return { paragraphs };
}

/**
 * Parse a single paragraph node
 */
function parseParagraph(pNode: any): FormattedParagraph {
  const runs: TextRun[] = [];
  let heading: FormattedParagraph['heading'];
  let alignment: FormattedParagraph['alignment'];
  let spacing: FormattedParagraph['spacing'];
  let indent: FormattedParagraph['indent'];
  
  // Check for heading style and other paragraph properties
  const pPr = pNode.getElementsByTagName('w:pPr')[0];
  if (pPr) {
    const pStyle = pPr.getElementsByTagName('w:pStyle')[0];
    if (pStyle) {
      const styleVal = pStyle.getAttribute('w:val');
      if (styleVal) {
        if (styleVal.includes('Heading1') || styleVal.includes('heading 1')) heading = 'HEADING_1';
        else if (styleVal.includes('Heading2') || styleVal.includes('heading 2')) heading = 'HEADING_2';
        else if (styleVal.includes('Heading3') || styleVal.includes('heading 3')) heading = 'HEADING_3';
        else if (styleVal.includes('Heading4') || styleVal.includes('heading 4')) heading = 'HEADING_4';
        else if (styleVal.includes('Heading5') || styleVal.includes('heading 5')) heading = 'HEADING_5';
        else if (styleVal.includes('Heading6') || styleVal.includes('heading 6')) heading = 'HEADING_6';
      }
    }
    
    // Check alignment
    const jc = pPr.getElementsByTagName('w:jc')[0];
    if (jc) {
      const jcVal = jc.getAttribute('w:val');
      if (jcVal === 'center') alignment = 'center';
      else if (jcVal === 'right') alignment = 'right';
      else if (jcVal === 'both') alignment = 'justify';
    }
    
    // Extract spacing
    const spacingNode = pPr.getElementsByTagName('w:spacing')[0];
    if (spacingNode) {
      spacing = {};
      const before = spacingNode.getAttribute('w:before');
      const after = spacingNode.getAttribute('w:after');
      const line = spacingNode.getAttribute('w:line');
      const lineRule = spacingNode.getAttribute('w:lineRule');
      
      if (before) spacing.before = parseInt(before);
      if (after) spacing.after = parseInt(after);
      if (line) spacing.line = parseInt(line);
      if (lineRule) spacing.lineRule = lineRule as any;
    }
    
    // Extract indentation
    const indNode = pPr.getElementsByTagName('w:ind')[0];
    if (indNode) {
      indent = {};
      const left = indNode.getAttribute('w:left');
      const right = indNode.getAttribute('w:right');
      const firstLine = indNode.getAttribute('w:firstLine');
      
      if (left) indent.left = parseInt(left);
      if (right) indent.right = parseInt(right);
      if (firstLine) indent.firstLine = parseInt(firstLine);
    }
  }
  
  // Parse text runs
  const runNodes = pNode.getElementsByTagName('w:r');
  for (let i = 0; i < runNodes.length; i++) {
    const rNode = runNodes[i];
    const run = parseTextRun(rNode);
    if (run.text) {
      runs.push(run);
    }
  }
  
  return { runs, heading, alignment, spacing, indent };
}

/**
 * Parse a single text run node
 */
function parseTextRun(rNode: any): TextRun {
  const run: TextRun = { text: '' };
  
  // Get text content
  const textNodes = rNode.getElementsByTagName('w:t');
  for (let i = 0; i < textNodes.length; i++) {
    run.text += textNodes[i].textContent || '';
  }
  
  // Get formatting properties
  const rPr = rNode.getElementsByTagName('w:rPr')[0];
  if (rPr) {
    // Bold
    if (rPr.getElementsByTagName('w:b').length > 0) {
      run.bold = true;
    }
    
    // Italic
    if (rPr.getElementsByTagName('w:i').length > 0) {
      run.italic = true;
    }
    
    // Underline
    if (rPr.getElementsByTagName('w:u').length > 0) {
      run.underline = true;
    }
    
    // Color (store as hex without # prefix for easier application)
    const color = rPr.getElementsByTagName('w:color')[0];
    if (color) {
      const colorVal = color.getAttribute('w:val');
      if (colorVal && colorVal !== 'auto') {
        run.color = colorVal; // Store without # prefix
      }
    }
    
    // Font
    const rFonts = rPr.getElementsByTagName('w:rFonts')[0];
    if (rFonts) {
      const fontVal = rFonts.getAttribute('w:ascii');
      if (fontVal) {
        run.font = fontVal;
      }
    }
    
    // Size (in half-points, convert to points)
    const sz = rPr.getElementsByTagName('w:sz')[0];
    if (sz) {
      const sizeVal = sz.getAttribute('w:val');
      if (sizeVal) {
        run.size = parseInt(sizeVal) / 2;
      }
    }
  }
  
  return run;
}

/**
 * Translate paragraphs while preserving formatting
 * 
 * @param structure - Parsed DOCX structure
 * @param translateFn - Translation function
 * @returns Translated structure with preserved formatting
 */
export async function translateDocxStructure(
  structure: DocxStructure,
  translateFn: (text: string) => Promise<string>
): Promise<DocxStructure> {
  const translatedParagraphs: FormattedParagraph[] = [];
  
  for (const paragraph of structure.paragraphs) {
    // Extract all text from runs
    const fullText = paragraph.runs.map(r => r.text).join('');
    
    // Skip empty paragraphs
    if (!fullText.trim()) {
      translatedParagraphs.push(paragraph);
      continue;
    }
    
    // Translate the full text
    const translatedText = await translateFn(fullText);
    
    // For Phase 1: Apply translated text to first run, keep formatting
    // TODO Phase 2: Smarter text distribution across runs
    const translatedRuns: TextRun[] = paragraph.runs.length > 0
      ? [{
          text: translatedText,
          bold: paragraph.runs[0].bold,
          italic: paragraph.runs[0].italic,
          underline: paragraph.runs[0].underline,
          color: paragraph.runs[0].color,
          font: paragraph.runs[0].font,
          size: paragraph.runs[0].size,
        }]
      : [{ text: translatedText }];
    
    translatedParagraphs.push({
      runs: translatedRuns,
      heading: paragraph.heading,
      alignment: paragraph.alignment,
    });
  }
  
  return { paragraphs: translatedParagraphs };
}

/**
 * Rebuild DOCX from translated structure
 * 
 * @param structure - Translated DOCX structure
 * @returns DOCX buffer
 */
export async function rebuildDocx(structure: DocxStructure): Promise<Buffer> {
  // Dynamic import to avoid DOMMatrix errors
  const { Document, Paragraph, TextRun, Packer, HeadingLevel, AlignmentType } = await import('docx');
  
  const paragraphs = structure.paragraphs.map(p => {
    const children = p.runs.map(r => 
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italic,
        underline: r.underline ? {} : undefined,
        color: r.color, // Already stored without # prefix
        font: r.font,
        size: r.size ? r.size * 2 : undefined, // Convert points to half-points
      })
    );
    
    // Map heading string to HeadingLevel enum
    const headingLevel = p.heading ? (HeadingLevel as any)[p.heading] : undefined;
    
    // Map alignment string to AlignmentType enum
    let alignment;
    if (p.alignment === 'center') alignment = AlignmentType.CENTER;
    else if (p.alignment === 'right') alignment = AlignmentType.RIGHT;
    else if (p.alignment === 'justify') alignment = AlignmentType.JUSTIFIED;
    
    // Build paragraph options
    const paragraphOptions: any = {
      children,
      heading: headingLevel,
      alignment,
    };
    
    // Add spacing if present
    if (p.spacing) {
      paragraphOptions.spacing = {};
      if (p.spacing.before !== undefined) paragraphOptions.spacing.before = p.spacing.before;
      if (p.spacing.after !== undefined) paragraphOptions.spacing.after = p.spacing.after;
      if (p.spacing.line !== undefined) paragraphOptions.spacing.line = p.spacing.line;
      if (p.spacing.lineRule) paragraphOptions.spacing.lineRule = p.spacing.lineRule;
    }
    
    // Add indentation if present
    if (p.indent) {
      paragraphOptions.indent = {};
      if (p.indent.left !== undefined) paragraphOptions.indent.left = p.indent.left;
      if (p.indent.right !== undefined) paragraphOptions.indent.right = p.indent.right;
      if (p.indent.firstLine !== undefined) paragraphOptions.indent.firstLine = p.indent.firstLine;
    }
    
    return new Paragraph(paragraphOptions);
  });
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  });
  
  return await Packer.toBuffer(doc);
}
