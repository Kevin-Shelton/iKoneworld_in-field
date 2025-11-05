# Email Viewer Demo - Multi-Language Translation

A demonstration email application showcasing real-time multi-language email translation capabilities using the Verbum AI Translation API.

## Features

### 📧 Email Management
- **Inbox View**: Browse email threads with multi-language participants
- **Thread View**: Read and reply to email conversations
- **Participant Language Detection**: Automatically identifies participant languages
- **Real-time Updates**: Messages update instantly when sent or received

### 🌐 Translation Features
- **Auto-Translation**: Incoming messages automatically translate to your preferred language
- **Smart Reply**: Compose in your language, auto-translates to recipient's language
- **Original/Translated Toggle**: View original text or translated version
- **120+ Languages**: Support for all languages available in Verbum AI API
- **Translation Storage**: Translations cached in database for instant retrieval

### 📚 Glossary Management
- **Custom Terms**: Define specialized terminology translations
- **Context Support**: Add context notes for when terms should be used
- **Language Pairs**: Create term mappings between any language pair
- **Consistent Translations**: Ensure technical terms translate consistently

### 🎨 User Interface
- **Modern Design**: Clean, dark-themed interface with gradient backgrounds
- **Responsive Layout**: Works on desktop, tablet, and mobile devices
- **Loading States**: Skeleton screens and spinners for better UX
- **Error Handling**: Clear error messages with retry options
- **Language Badges**: Visual indicators for message languages

## Architecture

### Database Schema

**email_threads**
- Stores conversation threads with participants
- JSONB field for participant details (email, name, language)
- Tracks last message timestamp for sorting

**email_messages**
- Individual messages with original content
- JSONB translations field stores all language versions
- Links to thread via foreign key

**glossary_terms**
- Custom translation term definitions
- Source/target language pairs
- Optional context field
- Soft delete with is_active flag

**send_intents**
- Outbound email queue (for future implementation)
- Translation status tracking

### API Routes

**`/api/email/translate`** (POST)
- Translates existing messages to target languages
- Checks for existing translations to avoid duplicates
- Updates message translations in database

**`/api/email/send`** (POST)
- Sends new email replies
- Auto-translates to recipient's language
- Updates thread timestamp

### Translation Flow

1. **Inbound Message**: User receives email in foreign language
2. **Auto-Detection**: System detects user's preferred language from profile
3. **Translation Request**: Calls Verbum API with source/target languages
4. **Storage**: Saves translation to message.translations JSONB field
5. **Display**: Shows translated version by default, original on toggle

### Language Code Mapping

The system maps detailed language codes (e.g., `en-US`, `es-CR`) to Verbum AI's format:
- Most languages: 2-letter code (`en`, `es`, `fr`)
- Special cases: `zh-Hans` (Chinese Simplified), `zh-Hant` (Traditional), `pt-pt` (Portuguese Portugal)

See `/app/api/translate/route.ts` for complete mapping logic.

## Setup Instructions

### 1. Database Migration

Run the email viewer schema migration in Supabase SQL Editor:

```sql
-- Located in: supabase/migrations/20250104_email_viewer_schema.sql
```

This creates:
- 4 new tables (email_threads, email_messages, glossary_terms, send_intents)
- Indexes for performance
- Row Level Security policies
- Triggers for updated_at timestamps

### 2. Seed Sample Data

Load demo email threads in Supabase SQL Editor:

```sql
-- Located in: supabase/seed-email-demo.sql
```

This creates:
- 3 email threads (English↔Spanish, English↔French, English↔Japanese)
- 5 messages with pre-translated content
- Sample participants with different languages

### 3. Environment Variables

Ensure these are configured in your environment:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Verbum AI Translation API
VERBUM_API_KEY=your_verbum_api_key
```

### 4. User Language Setup

Users need a language preference in their profile:

```sql
-- Set user language in Supabase
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{language}',
  '"en"'
)
WHERE email = 'user@example.com';
```

Or use the profile page in the app to set language preference.

## Usage Guide

### Viewing Emails

1. Navigate to `/email` to see inbox
2. Click any thread to view conversation
3. Messages automatically translate to your language
4. Click language badge or eye icon to toggle original/translated

### Sending Replies

1. Open an email thread
2. Type your reply in your preferred language
3. Click "Send Reply"
4. Message auto-translates to recipient's language
5. Both versions stored in database

### Managing Glossary

1. Click "Glossary" button in email inbox or thread
2. Click "Add Term" to create new entry
3. Select source/target languages
4. Enter source term and custom translation
5. Optionally add context notes
6. Term will be used in future translations

### Testing Multi-Language Flow

1. Set your profile language to English
2. Open the Spanish thread (Carlos García)
3. See Spanish messages auto-translated to English
4. Reply in English
5. Your reply auto-translates to Spanish for recipient
6. Toggle to see both versions

## File Structure

```
app/
├── email/
│   ├── page.tsx                    # Inbox view
│   ├── thread/[id]/page.tsx        # Thread view with messages
│   └── glossary/page.tsx           # Glossary management
├── api/
│   └── email/
│       ├── translate/route.ts      # Translation API
│       └── send/route.ts           # Send message API
lib/
└── hooks/
    └── useEmailTranslation.ts      # Auto-translation hook
supabase/
├── migrations/
│   └── 20250104_email_viewer_schema.sql
└── seed-email-demo.sql
```

## Integration with Existing Apps

The email viewer shares the same Supabase database as the in-field translation and chat applications:

- **Shared `users` table**: Same authentication and user profiles
- **Shared Verbum API**: Reuses translation service configuration
- **Consistent patterns**: Follows same architecture as chat app
- **Cross-app navigation**: Accessible from main navigation menu

## Deployment

### Vercel Deployment

1. Push `email` branch to GitHub
2. Create new Vercel project or update existing
3. Configure environment variables in Vercel dashboard
4. Deploy from `email` branch
5. Configure custom domain: `demo-email.ikoneworld.net`

### Domain Configuration

In Vercel project settings:
1. Add domain: `demo-email.ikoneworld.net`
2. Configure DNS records as instructed
3. Enable HTTPS (automatic with Vercel)

### Environment Variables in Vercel

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `VERBUM_API_KEY`
- `DATABASE_URL` (if using direct database access)

## Future Enhancements

### Planned Features
- [ ] Real-time message updates with Supabase subscriptions
- [ ] Email attachments support
- [ ] Rich text editor for composing
- [ ] Email search and filtering
- [ ] Glossary integration into translation pipeline
- [ ] Translation confidence scores
- [ ] Multiple recipient support (CC/BCC)
- [ ] Email templates
- [ ] Notification system for new emails

### Technical Improvements
- [ ] Implement send_intents queue processing
- [ ] Add retry logic for failed translations
- [ ] Optimize translation caching
- [ ] Add analytics tracking
- [ ] Performance monitoring
- [ ] Error logging and reporting

## Troubleshooting

### Messages not translating
- Check VERBUM_API_KEY is configured
- Verify user has language set in profile
- Check browser console for API errors
- Ensure RLS policies allow access

### Cannot send replies
- Verify authentication is working
- Check thread exists and is accessible
- Ensure recipient language is set
- Review API route logs

### Glossary terms not saving
- Check unique constraint (term + language pair must be unique)
- Verify user is authenticated
- Check RLS policies on glossary_terms table

## Support

For issues or questions:
- Check Supabase logs for database errors
- Review Vercel function logs for API errors
- Verify Verbum API quota and limits
- Contact iKoneworld support team

## License

Proprietary - iKoneworld Demo Application
