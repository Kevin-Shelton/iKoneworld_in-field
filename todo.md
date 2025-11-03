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
