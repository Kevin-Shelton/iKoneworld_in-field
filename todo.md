# iKOneWorld In-Field Translation App TODO

## Conversation Creation Bug
- [x] Fix createConversation to use language1 and language2 columns instead of user_language and guest_language
- [x] Language codes are being retrieved from localStorage correctly
- [x] Test conversation creation with actual language codes

## Translation API Authentication Error
- [x] Investigate translation API endpoint returning 401 Unauthorized
- [x] Confirmed VERBUM_API_KEY environment variable is needed
- [x] Found issue: Verbum AI uses x-api-key header, not Authorization Bearer
- [x] Fixed all three API endpoints (translate, synthesize, recognize) to use x-api-key header
- [x] Added TypeScript non-null assertions for environment variables

## Language Code Format Mismatch
- [x] Create mapping function to convert our language codes (en-US, es-CR) to Verbum AI format (en, es)
- [x] Handle special cases (zh-Hans, zh-Hant, pt vs pt-pt, fr vs fr-ca)
- [x] Update translate API to use mapped language codes
- [x] Added debug logging to show original and mapped codes

## Translation Display Bug - HIGH PRIORITY
- [ ] Investigate why Guest Messages panel shows only timestamp instead of translated text
- [ ] Check translation API response format and data flow
- [ ] Fix frontend code to display translated text correctly
- [ ] Test with es-MX (Mexican Spanish) to es-CR (Costa Rican Spanish)

## Database Alignment with Verbum AI Official Support
- [x] Verified STT supports 130 regional dialects (19 Spanish, 14 English, 15 Arabic)
- [x] Verified Translation supports 137 languages with only 11 regional variants (NO Spanish/English/Arabic dialects)
- [x] Confirmed generic translation is acceptable per user requirements
- [ ] Add 2 missing Chinese STT variants: zh-CN-shandong, zh-CN-sichuan
- [ ] Verify TTS voices use dialect-specific codes (es-MX, es-CR, not generic es)
- [ ] Create migration script if needed

## Requirements Clarification
- ✅ **Text Translation**: Generic translation is acceptable (es → es, en → en)
- ✅ **Voice (TTS)**: MUST use dialect-specific voices (es-MX, es-CR, en-US, en-GB)
- ✅ **STT**: Already supports 130 regional dialects

## Conversation Management Improvements
- [x] Add conversation_type column to conversations table (demo vs translation)
- [x] Add employee_name column to conversations table
- [x] Update demo/start API to save conversation type and employee name
- [x] Create public customer chat page at /chat/[sessionId] without authentication
- [x] Fix QR code to point to public customer URL
- [x] Add "Resume Chat" button for active demo conversations on dashboard
- [x] Add Conversation Type column to dashboard table
- [x] Add Employee Name column to dashboard table
- [x] Add filter by Employee dropdown
- [x] Add filter by Conversation Type dropdown
- [x] Add date range picker filter

## Build Errors
- [x] Fix TypeScript error: Property 'name' does not exist on type 'User' in dashboard/page.tsx line 287
- [x] Fix TypeScript error: Property 'session_id' does not exist on metadata type in dashboard/page.tsx line 419

## Dashboard Filter Issues
- [x] Fix empty Employee dropdown - no employee names showing
- [x] Fix empty Type dropdown - no Demo Chat/Translation options showing
- [x] Fix date filter not returning results for Nov 3rd conversations

## Employee Name Source Issue
- [x] Fix dashboard to use database users.name instead of Supabase Auth user_metadata.name
- [x] Fetch user profile from database to get the correct display name
- [x] Update StartDemoChat to receive name from database instead of auth metadata

## New Demo Chats Using Email Instead of Display Name
- [x] Debug why dbUserName is null or empty for new demo chats
- [x] Check if user.name is properly set in database
- [x] Verify /api/users/sync is returning userName correctly
- [x] Fixed: Removed name update for existing users in sync endpoint

## Timestamp Display Issue
- [x] Fix dashboard timestamps to show user's local time instead of UTC
- [x] Update date and time display to use browser's timezone

## UI Text Updates
- [x] Change "Start Translation Session" button text to "In-Field"

## Chat Button Updates
- [x] Change "Start Demo Chat" button text to "Chat"
- [x] Update conversation type from "demo" to "chat"
- [x] Update dashboard to display "Chat" instead of "Demo Chat"
- [x] Update filter to show "Chat" option instead of "Demo Chat"

## Cross-Domain Authentication Setup
- [x] Update Supabase cookie configuration to share auth across domains
- [x] Configure cookie domain to .ikoneworld.net
- [ ] Test authentication flow from portal to in-field app
- [ ] Document Supabase dashboard settings needed

## Permanent Chat URL
- [x] Create /chat landing page with Start Chat button
- [x] Implement auto-create conversation on button click
- [x] Add welcome message and instructions
- [ ] Update QR code generation to use /chat URL

## User Fetch Error
- [x] Debug "Failed to fetch users" error in application
- [x] Check API endpoint for users
- [x] Verify database query and permissions
- [x] Fixed: Removed incorrect authorization header check

## Document Translation - Formatting Preservation & Delete (Current Sprint)

### Delete Functionality
- [x] Add delete button to DocumentList component
- [x] Create DELETE /api/documents/[id]/delete endpoint
- [x] Delete conversation from database
- [x] Delete files from Supabase storage (original + translated)
- [x] Add confirmation dialog before delete
- [ ] Add delete button to admin queue page (optional)

### Formatting Preservation
- [x] Update mammothDocumentProcessor to use convertToHtml() instead of extractRawText()
- [x] Preserve HTML structure during translation
- [x] Convert HTML back to DOCX with formatting intact
- [x] Update upload-smart route to use new formatting-preserving processor
- [ ] Test with images/logos (placeholders implemented, full support pending)
- [ ] Test with headers and colored text
- [ ] Test with bullet lists and numbering
- [ ] Test with tables
- [ ] Test with fonts and text styling

### Testing
- [ ] Test delete functionality (user view)
- [ ] Test delete functionality (admin view)
- [ ] Test formatting preservation with original document
- [ ] Verify images are preserved
- [ ] Verify colors and fonts are preserved
- [ ] Verify layout is preserved

## Document Translation - Completed Features ✅

### Phase 1: Core Translation System
- [x] Mammoth-based DOCX translation
- [x] Verbum API integration
- [x] File upload and storage
- [x] Basic translation workflow

### Phase 2: Queue Management
- [x] Async queue system with Vercel Cron
- [x] Admin queue management interface
- [x] Status tracking (queued → active → completed)
- [x] Cancel/Retry functionality
- [x] Method indicators (Fast/Chunked)
- [x] Error handling and timeout detection

### Phase 3: Bug Fixes
- [x] Fixed DOCX corruption issues
- [x] Fixed database schema mismatches
- [x] Fixed download endpoint
- [x] Fixed stuck translations
- [x] Replaced broken skeleton method with mammoth

## Build Error - Next.js 16 Async Params
- [x] Fix TypeScript error in delete route: params is now Promise<{ id: string }> in Next.js 16
- [x] Update DELETE handler to await params before accessing id

## Chunking Method - Formatting Preservation (Current Sprint)

### Problem
- Large documents (>100KB) use chunking method which loses ALL formatting
- Currently extracts plain text, translates, outputs as .txt file
- Small documents preserve formatting, but large ones don't

### Implementation Tasks
- [x] Create HTML chunking function that preserves tags
- [x] Update documentProcessor.ts to convert DOCX → HTML for chunking
- [x] Implement smart HTML chunking (split by sections without breaking tags)
- [x] Update upload-smart route to use HTML for chunked documents
- [x] Update translate route to handle HTML chunks
- [x] Update createTranslatedDocumentBuffer to convert HTML → DOCX
- [x] Store HTML chunks in database with is_html_content flag
- [x] Update cron job to reconstruct HTML documents with formatting
- [ ] Test with large document (>100KB) to verify formatting preservation

### Technical Approach
1. Convert DOCX → HTML (preserving formatting)
2. Chunk HTML by sections/paragraphs (keep tags intact)
3. Store HTML chunks in conversation_messages
4. Translate each HTML chunk (preserve tags)
5. Reassemble translated HTML chunks
6. Convert HTML → DOCX with formatting
