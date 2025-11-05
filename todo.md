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
