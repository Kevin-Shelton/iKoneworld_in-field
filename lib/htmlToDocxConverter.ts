/**
 * HTML to DOCX Converter
 * 
 * Separated into its own file to enable dynamic importing
 * and avoid DOMMatrix errors in serverless environments
 */

import { Document, Paragraph, TextRun, Packer, AlignmentType, HeadingLevel } from 'docx';

interface ParsedElement {
  text: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  heading?: string;
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHtmlElement(html: string): ParsedElement {
  const text = extractTextFromHtml(html);
  
  return {
    text,
    isBold: /<(strong|b)[\s>]/.test(html),
    isItalic: /<(em|i)[\s>]/.test(html),
    isUnderline: /<u[\s>]/.test(html),
    heading: html.match(/<h1[\s>]/) ? 'HEADING_1' :
             html.match(/<h2[\s>]/) ? 'HEADING_2' :
             html.match(/<h3[\s>]/) ? 'HEADING_3' :
             html.match(/<h4[\s>]/) ? 'HEADING_4' :
             html.match(/<h5[\s>]/) ? 'HEADING_5' :
             html.match(/<h6[\s>]/) ? 'HEADING_6' :
             undefined,
  };
}

/**
 * Convert HTML to DOCX with formatting
 */
export async function convertHtmlToDocx(html: string): Promise<Buffer> {
  const paragraphs: Paragraph[] = [];
  
  // Split by paragraph and heading tags
  const elements = html.match(/<(p|h[1-6]|li)[^>]*>.*?<\/\1>/gi) || [];
  
  for (const element of elements) {
    const parsed = parseHtmlElement(element);
    
    if (!parsed.text.trim()) continue;
    
    const textRun = new TextRun({
      text: parsed.text,
      bold: parsed.isBold,
      italics: parsed.isItalic,
      underline: parsed.isUnderline ? {} : undefined,
    });
    
    // Map string heading to HeadingLevel enum
    const headingLevel = parsed.heading ? (HeadingLevel as any)[parsed.heading] : undefined;
    
    paragraphs.push(
      new Paragraph({
        children: [textRun],
        heading: headingLevel,
      })
    );
  }
  
  // Handle images - extract base64 data
  const imageMatches = html.matchAll(/<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"/gi);
  for (const match of imageMatches) {
    try {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun('[Image: embedded content]')],
        })
      );
    } catch (error) {
      console.error('[Convert HTML] Error processing image:', error);
      paragraphs.push(
        new Paragraph({
          children: [new TextRun('[Image]')],
        })
      );
    }
  }
  
  // Fallback: if no paragraphs found, create from plain text
  if (paragraphs.length === 0) {
    const plainText = extractTextFromHtml(html);
    const lines = plainText.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(line)],
        })
      );
    }
  }
  
  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });
  
  return await Packer.toBuffer(doc);
}
