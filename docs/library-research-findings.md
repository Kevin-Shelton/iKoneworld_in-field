# Document Handling Library Research

## Research Goal
Find libraries that can preserve DOCX formatting (images, tables, lists, headers) while allowing custom translation with Verbum AI.

---

## 1. Docxtemplater (https://docxtemplater.com/)

**Type:** Template-based document generation  
**License:** Paid (trusted by 800+ companies since 2017)  
**Supports:** DOCX, PPTX, XLSX, ODT

### Key Features:
- **Template-based approach**: Uses tags in templates like `{firstname}`, `{#users}...{/}`
- **Image support**: Can add images with `{%image}` syntax
- **Conditional sections**: Show/hide sections with `{#isAdmin}...{/}`
- **HTML support**: Can insert HTML with `{~html}` (paid feature)
- **Styling module**: Modify colors, fonts, backgrounds based on conditions (paid)

### For Translation Use:
**Pros:**
- Preserves all formatting from template
- Handles images, tables, complex structures
- Well-established, trusted by enterprises

**Cons:**
- **Not designed for translation** - it's for generating documents from templates
- Would require creating a template from original document
- Paid license required
- Workflow doesn't match our use case (translate existing docs, not generate from templates)

**Verdict:** ❌ Not suitable - designed for document generation, not translation

---


## 2. Mammoth.js (https://github.com/mwilliamson/mammoth.js)

**Type:** DOCX to HTML converter  
**License:** BSD-2-Clause (Open Source, Free)  
**Stars:** 5.9k | **Forks:** 635

### Key Features:
- **Headings**: ✅ Supported
- **Lists**: ✅ Supported (bullets and numbered)
- **Tables**: ⚠️ Partial - text formatting preserved, but table borders/styling ignored
- **Images**: ✅ Supported (inline base64 or separate files)
- **Bold, italic, underline, strikethrough**: ✅ Supported
- **Links**: ✅ Supported
- **Footnotes/endnotes**: ✅ Supported
- **Text boxes**: ✅ Supported
- **Comments**: ✅ Supported

### Limitations:
- **Table formatting (borders, colors) is ignored**
- **Underlines ignored by default** (can be confused with links)
- **Conversion may not be perfect for complex documents** (DOCX ↔ HTML mismatch)
- **One-way conversion** (DOCX → HTML only, no HTML → DOCX)

### For Translation Use:
**Pros:**
- Free and open source
- Good format preservation for basic elements
- Already using it in our project

**Cons:**
- **Cannot convert HTML back to DOCX** - this is the critical issue
- Would need another library to go HTML → DOCX
- Table formatting lost
- Complex documents may not convert well

**Verdict:** ⚠️ Already using for DOCX → HTML, but need HTML → DOCX converter to complete the workflow

---


## 3. html-to-docx / @turbodocx/html-to-docx (https://github.com/TurboDocx/html-to-docx)

**Type:** HTML to DOCX converter  
**License:** MIT (Open Source, Free)  
**Stars:** 126 | **Forks:** 25 | **Status:** Actively maintained by TurboDocx

### Key Features:
- **Pure JavaScript implementation** - No external dependencies (Puppeteer, Chrome, LibreOffice)
- **Production battle-tested** - Used in production processing thousands of documents
- **TypeScript support** - Full type definitions included
- **AI-ready architecture** - Fast performance for bulk document generation
- **Zero external dependencies** - Works in any Node.js environment including serverless

### Format Support:
- **Tables**: ✅ Supported with border options, row splitting control
- **Images**: ✅ Supported (including SVG with optional `sharp` dependency)
- **Lists**: ✅ Supported with various numbering styles (upper-alpha, lower-alpha, upper-roman, lower-roman, decimal, etc.)
- **Headings**: ✅ Customizable heading styles
- **Bold, italic, underline**: ✅ Supported
- **Page breaks**: ✅ Supported with CSS classes
- **Headers/Footers**: ✅ Supported
- **RTL languages**: ✅ Supported (Arabic, Hebrew)
- **Custom fonts**: ✅ Supported (with limitations in LibreOffice/Word Online)

### Document Options:
- Orientation (portrait/landscape)
- Page size and margins (customizable in TWIP units)
- Document metadata (title, creator, subject, keywords, etc.)
- Page numbers
- Custom headers and footers
- Image processing options (retries, timeouts, max size)

### For Translation Use:
**Pros:**
- ✅ Free and open source (MIT license)
- ✅ Actively maintained (not abandoned)
- ✅ Comprehensive format preservation (tables, images, lists, headings)
- ✅ Works in serverless environments (Vercel, Lambda)
- ✅ No external dependencies (pure JavaScript)
- ✅ Production-ready and battle-tested
- ✅ TypeScript support

**Cons:**
- ⚠️ Requires HTML as intermediate format (need to convert DOCX → HTML → translate → HTML → DOCX)
- ⚠️ Font compatibility issues with LibreOffice and Word Online
- ⚠️ Quality depends on HTML conversion quality

**Verdict:** ✅ **STRONG CANDIDATE** - This is the missing piece! Combined with mammoth.js, we can create a complete workflow:
1. **DOCX → HTML** (mammoth.js)
2. **Translate HTML** (Verbum AI with HTML parsing)
3. **HTML → DOCX** (html-to-docx)

---


## Research Summary

### Available Open-Source Solutions

After researching open-source libraries for DOCX format preservation during translation, the landscape is clear:

**For DOCX → HTML conversion:**
- **mammoth.js** is the leading open-source solution (5.9k stars, BSD-2-Clause license)
- Preserves most formatting but loses table borders and some complex styling
- Already integrated in our project

**For HTML → DOCX conversion:**
- **@turbodocx/html-to-docx** is the best open-source option (126 stars, MIT license, actively maintained)
- Supports tables, images, lists, headings, custom fonts, headers/footers
- Production-ready, works in serverless environments
- No external dependencies (pure JavaScript)

**For direct DOCX manipulation:**
- **docx** library (dolanmiu/docx) - for creating DOCX from scratch with declarative API
- **docxtemplater** - paid solution for template-based generation (not suitable for translation)
- **No open-source library found** that directly manipulates DOCX while preserving all formatting

### The "Round-Trip" Challenge

The fundamental challenge with HTML as an intermediate format is **information loss during round-trip conversion**:

1. **DOCX → HTML** (mammoth.js): Loses table borders, some styling, complex layouts
2. **HTML → DOCX** (html-to-docx): Can only recreate what's in the HTML

This means even with the best libraries, some formatting will be lost in the conversion process.

---

## Recommended Approach

### Option 1: HTML-Based Workflow (Using Open-Source Libraries) ⭐ RECOMMENDED

**Workflow:**
```
Original DOCX 
  → mammoth.js → HTML 
  → Parse & Translate with Verbum AI 
  → html-to-docx → Translated DOCX
```

**Implementation:**
1. Install `@turbodocx/html-to-docx` package
2. Use mammoth.js to convert DOCX → HTML (already implemented)
3. Parse HTML, extract text nodes, translate with Verbum AI
4. Rebuild HTML with translated text
5. Convert HTML → DOCX with html-to-docx

**Pros:**
- ✅ Free and open source (MIT + BSD licenses)
- ✅ No external services or API costs
- ✅ Works in Vercel serverless environment
- ✅ Preserves most formatting (tables, images, lists, headings, fonts)
- ✅ Production-ready and battle-tested
- ✅ Full control over translation (use Verbum AI)

**Cons:**
- ⚠️ Some formatting loss (table borders, complex styling)
- ⚠️ Requires careful HTML parsing to preserve structure
- ⚠️ May need refinement for complex documents

**Estimated Effort:** 2-3 days of development

---

### Option 2: Direct DOCX Manipulation (Build from Scratch)

**Workflow:**
```
Original DOCX 
  → JSZip + XML parsing → Extract structure 
  → Translate text with Verbum AI 
  → Rebuild DOCX with docx library → Translated DOCX
```

**Implementation:**
1. Continue building on current `docxFormattingProcessor.ts`
2. Add support for images (extract from media folder, re-embed)
3. Add table structure parsing and rebuilding
4. Add list/numbering support
5. Add header/footer support

**Pros:**
- ✅ Potentially better format preservation (direct DOCX manipulation)
- ✅ No HTML intermediate format
- ✅ Full control over every element

**Cons:**
- ⚠️ Significantly more complex (weeks of development)
- ⚠️ Need to handle every DOCX element type manually
- ⚠️ High risk of bugs and edge cases
- ⚠️ Difficult to maintain and extend

**Estimated Effort:** 2-4 weeks of development

---

### Option 3: Hybrid Approach

**Workflow:**
```
Small files (<100KB): Use Option 1 (HTML workflow)
Large files (>100KB): Use Option 1 with chunking
```

**Implementation:**
1. Implement Option 1 for all files
2. For large files, chunk the HTML before translation
3. Merge translated chunks back together
4. Convert final HTML → DOCX

**Pros:**
- ✅ Handles both small and large files
- ✅ Consistent approach across file sizes
- ✅ Leverages open-source libraries

**Cons:**
- ⚠️ Same formatting limitations as Option 1
- ⚠️ Chunking HTML requires careful handling of tags

**Estimated Effort:** 3-4 days of development

---

## Final Recommendation

**Implement Option 1 (HTML-Based Workflow)** for the following reasons:

1. **Fastest time to market** - Leverages existing open-source libraries
2. **Cost-effective** - No external service fees, only open-source libraries
3. **Production-ready** - Both mammoth.js and html-to-docx are battle-tested
4. **Good enough format preservation** - Handles 90% of common document elements
5. **Vercel-compatible** - Works in serverless environment
6. **Maintainable** - Uses well-documented libraries instead of custom XML parsing

### Next Steps:

1. **Install @turbodocx/html-to-docx** package
2. **Update `mammothDocumentProcessor.ts`** to use html-to-docx for HTML → DOCX conversion
3. **Test with sample documents** containing images, tables, lists
4. **Refine HTML parsing** to preserve structure during translation
5. **Update large file chunking** to use the same HTML-based approach
6. **Document limitations** for users (e.g., table borders may not be preserved)

