# Enterprise Settings Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing enterprise-level admin controls for audio recordings and transcripts with persistent audio access.

## Implementation Status

### ✅ Completed

1. **Database Schema Design** - Comprehensive design for enterprise settings and permissions
2. **Database Migrations** - SQL scripts for all required schema changes
3. **Enterprise Settings Service** - Backend service for managing settings
4. **Audio URL Generation** - Client-side authenticated URL generation
5. **Admin Settings UI** - Complete admin interface for managing settings
6. **API Endpoints** - REST API for settings management
7. **Dashboard Updates** - Audio player now uses authenticated URLs

### 🔄 Remaining Tasks

1. **Run Database Migrations** - Execute SQL scripts in Supabase
2. **Update Translation Page** - Check settings before recording
3. **Add Navigation Link** - Link to admin settings page
4. **Test End-to-End** - Verify all functionality works

## Step-by-Step Implementation

### Step 1: Run Database Migrations

Execute these SQL scripts in your Supabase SQL Editor in order:

#### 1.1 Create Enterprise Settings Table
```bash
File: /migrations/create-enterprise-settings.sql
```

This creates the `enterprise_settings` table with RLS policies and inserts default settings.

#### 1.2 Add User Roles
```bash
File: /migrations/add-user-roles.sql
```

This adds the `role` column to the `users` table and sets the first user of each enterprise as admin.

#### 1.3 Update Storage RLS Policies
```bash
File: /migrations/update-storage-rls-policies.sql
```

This updates Supabase Storage RLS policies to enable persistent authenticated access.

**Important:** After running this migration, test that authenticated users can access audio files.

### Step 2: Verify Database Changes

Run these queries to verify migrations were successful:

```sql
-- Check enterprise_settings table exists
SELECT * FROM enterprise_settings LIMIT 1;

-- Check users have roles
SELECT id, email, role, enterprise_id FROM users LIMIT 5;

-- Check storage policies
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
AND policyname LIKE '%audio%';
```

### Step 3: Update Translation Page

The translation page needs to check enterprise settings before starting recording.

**File to modify:** `/app/translate/page.tsx`

**Add at the top:**
```typescript
import { getEnterpriseSettings } from '@/lib/db/enterprise-settings';
```

**Modify `initializeConversation` function:**
```typescript
const initializeConversation = async (userLanguage: string, guestLanguage: string, userId: number) => {
  try {
    // Check enterprise settings
    const settings = await fetch(`/api/admin/settings?enterpriseId=${DEFAULT_ENTERPRISE_ID}`);
    const { settings: enterpriseSettings } = await settings.json();
    
    // Store settings in state
    setEnableRecording(enterpriseSettings.enable_audio_recording);
    setEnableTranscripts(enterpriseSettings.enable_transcripts);
    
    // ... rest of existing code
  } catch (err) {
    console.error("Error initializing conversation:", err);
  }
};
```

**Add state variables:**
```typescript
const [enableRecording, setEnableRecording] = useState(true);
const [enableTranscripts, setEnableTranscripts] = useState(true);
```

**Modify recording logic:**
```typescript
// In startRecording or wherever recording begins
if (!enableRecording) {
  console.log('Audio recording disabled by enterprise settings');
  return;
}
```

**Modify message saving:**
```typescript
// When saving messages
if (enableTranscripts) {
  // Save to database
  await fetch("/api/conversations", {
    method: "POST",
    body: JSON.stringify({
      action: "saveMessage",
      // ... message data
    }),
  });
} else {
  // Don't save transcript, just process in real-time
  console.log('Transcript saving disabled by enterprise settings');
}
```

### Step 4: Add Navigation Link to Admin Settings

**File to modify:** `/components/Navigation.tsx`

Add a link to the admin settings page (visible only to admins):

```typescript
// Add this to the navigation menu
{userRole === 'admin' && (
  <Link 
    href="/admin/settings"
    className="text-gray-700 hover:text-blue-600 transition-colors"
  >
    Admin Settings
  </Link>
)}
```

You'll need to fetch and store the user's role in the Navigation component.

### Step 5: Test the Implementation

#### 5.1 Test Admin Settings Page

1. Navigate to `/admin/settings`
2. Verify all settings load correctly
3. Try toggling each setting
4. Click "Save Settings"
5. Refresh the page and verify settings persisted

#### 5.2 Test Audio Recording Control

1. Go to admin settings
2. **Disable** audio recording
3. Go to translation page
4. Start a conversation
5. Verify no audio is recorded
6. Re-enable audio recording
7. Start another conversation
8. Verify audio IS recorded

#### 5.3 Test Transcript Control

1. Go to admin settings
2. **Disable** "Save Transcripts to Database"
3. Start a conversation
4. Speak some phrases
5. Check database - verify no messages were saved
6. Re-enable transcript saving
7. Start another conversation
8. Verify messages ARE saved

#### 5.4 Test Audio Playback

1. Create a conversation with audio
2. Go to dashboard
3. Click on the conversation
4. Verify audio player loads and plays
5. Wait more than 1 hour (or close and reopen)
6. Verify audio STILL plays (persistent access)

#### 5.5 Test Role-Based Access

1. Go to admin settings
2. Set audio access to "admin" and "manager" only
3. Create a test user with "employee" role
4. Log in as that employee
5. Try to play audio from dashboard
6. Verify access is denied (implement this check)

### Step 6: Implement Permission Checks

Add permission checking to the dashboard before showing audio player:

**File to modify:** `/app/dashboard/page.tsx`

```typescript
// Add state for permissions
const [canAccessAudio, setCanAccessAudio] = useState(false);

// Check permissions when viewing conversation
const handleViewConversation = async (conv: Conversation) => {
  setSelectedConversation(conv);
  fetchConversationMessages(conv.id);
  
  // Check if user has audio access
  const permissionResponse = await fetch(
    `/api/audio/check-access?conversationId=${conv.id}&userId=${dbUserId}`
  );
  const { hasAccess } = await permissionResponse.json();
  setCanAccessAudio(hasAccess);
};

// In the audio player section
{canAccessAudio && (selectedConversation.audio_file_path || selectedConversation.audio_url) && (
  // ... audio player code
)}

{!canAccessAudio && selectedConversation.audio_url && (
  <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
    <p className="text-sm text-yellow-800">
      You do not have permission to access audio recordings. Contact your administrator.
    </p>
  </div>
)}
```

### Step 7: Create Permission Check API Endpoint

**Create file:** `/app/api/audio/check-access/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { canUserAccessAudio } from '@/lib/db/enterprise-settings';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get('conversationId');
    const userId = searchParams.get('userId');

    if (!conversationId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get conversation to find enterprise_id
    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .select('enterprise_id')
      .eq('id', conversationId)
      .single();

    if (error || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check if user has access
    const hasAccess = await canUserAccessAudio(
      parseInt(userId), 
      conversation.enterprise_id
    );

    return NextResponse.json({ 
      hasAccess,
      reason: hasAccess ? null : 'Your role does not have permission to access audio recordings'
    });
  } catch (error) {
    console.error('Error checking audio access:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Configuration

### Environment Variables

Ensure these are set in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Default Settings

When an enterprise is created, these default settings are applied:

- **Audio Recording**: Enabled
- **Message Audio**: Disabled
- **Transcripts**: Enabled
- **Save Transcripts**: Enabled
- **Audio Access**: admin, manager, employee
- **Transcript Access**: admin, manager, employee
- **Retention**: Keep forever

## Troubleshooting

### Issue: Audio still doesn't play

**Check:**
1. RLS policies are correctly applied
2. User is authenticated
3. Browser console for errors
4. File path is correct in database

**Solution:**
```sql
-- Verify RLS policies
SELECT * FROM pg_policies WHERE tablename = 'objects';

-- Check file exists in storage
SELECT name FROM storage.objects WHERE bucket_id = 'audio-recordings' LIMIT 10;
```

### Issue: Settings don't save

**Check:**
1. User has admin role
2. API endpoint is accessible
3. Database connection is working

**Solution:**
```sql
-- Verify user is admin
SELECT id, email, role FROM users WHERE role = 'admin';

-- Check enterprise_settings table
SELECT * FROM enterprise_settings;
```

### Issue: Permission denied errors

**Check:**
1. RLS policies are enabled
2. User's enterprise_id matches file path
3. User's role is in allowed roles

**Solution:**
```sql
-- Check user's enterprise and role
SELECT id, email, enterprise_id, role FROM users WHERE id = YOUR_USER_ID;

-- Check enterprise settings
SELECT audio_access_roles FROM enterprise_settings WHERE enterprise_id = 'YOUR_ENTERPRISE_ID';
```

## Security Considerations

1. **Admin-Only Access**: Only users with `role = 'admin'` can modify enterprise settings
2. **RLS Enforcement**: All database operations respect Row Level Security policies
3. **Storage Security**: Audio files are protected by RLS policies on storage.objects
4. **Role Validation**: Backend validates user roles before granting access
5. **Audit Trail**: Track who changes settings with `created_by` and `updated_by` fields

## Performance Considerations

1. **Client-Side URLs**: Audio URLs are generated on the client to reduce server load
2. **Caching**: Consider caching enterprise settings in memory
3. **Lazy Loading**: Load settings only when needed
4. **Batch Operations**: Process multiple files in parallel when possible

## Future Enhancements

1. **Audit Logging**: Track who accesses which recordings and when
2. **Encryption**: Encrypt audio files at rest
3. **Automatic Cleanup**: Scheduled job to delete old recordings
4. **Cost Dashboard**: Real-time storage cost tracking
5. **Per-User Settings**: Override enterprise settings for specific users
6. **Download Control**: Prevent audio downloads for certain roles
7. **Watermarking**: Add audio watermarks to prevent unauthorized sharing

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Supabase logs for detailed error messages
3. Check browser console for client-side errors
4. Verify database migrations completed successfully

## Summary

This implementation provides:
- ✅ Persistent audio access for authenticated users
- ✅ Admin-level controls for recordings and transcripts
- ✅ Role-based access control
- ✅ Cost control through selective recording
- ✅ Privacy protection through access restrictions
- ✅ Secure storage with RLS policies
- ✅ Scalable architecture for future enhancements

The system is production-ready and can be deployed once all steps are completed and tested.
