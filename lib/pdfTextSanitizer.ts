/**
 * Sanitize text for PDF generation
 * Replaces Unicode characters with ASCII equivalents for WinAnsi encoding
 */
export function sanitizeForPDF(text: string): string {
  return text
    // Arrows
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/↑/g, '^')
    .replace(/↓/g, 'v')
    // Bullets and dashes
    .replace(/•/g, '*')
    .replace(/–/g, '-')
    .replace(/—/g, '--')
    // Quotes
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    // Other symbols
    .replace(/…/g, '...')
    .replace(/©/g, '(c)')
    .replace(/®/g, '(R)')
    .replace(/™/g, '(TM)')
    // Replace any remaining non-ASCII characters with ?
    .replace(/[^\x00-\x7F]/g, '?');
}
