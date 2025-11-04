# Enterprise Settings & Audio Permissions Design

## Overview

This design implements enterprise-level admin controls for audio recordings and transcripts, with persistent audio access for authenticated users and role-based permissions.

## Requirements

1. ✅ **Persistent Audio Access**: Authenticated users can listen to audio anytime, not just during the first hour
2. ✅ **Admin Controls**: Admins can enable/disable recordings and transcripts at the enterprise level
3. ✅ **Role-Based Access**: Admins define who has permission to listen to audio
4. ✅ **Cost Control**: Disable recordings to reduce storage costs
5. ✅ **Privacy Control**: Disable transcripts to protect sensitive conversations

## Database Schema Changes

### 1. New Table: `enterprise_settings`

Stores enterprise-level configuration for recordings and transcripts.

```sql
CREATE TABLE enterprise_settings (
  id SERIAL PRIMARY KEY,
  enterprise_id VARCHAR(255) UNIQUE NOT NULL,
  
  -- Recording controls
  enable_audio_recording BOOLEAN DEFAULT true,
  enable_message_audio BOOLEAN DEFAULT false,  -- Per-message audio (future feature)
  
  -- Transcript controls
  enable_transcripts BOOLEAN DEFAULT true,
  save_transcripts_to_db BOOLEAN DEFAULT true,
  
  -- Audio access controls
  audio_access_roles TEXT[] DEFAULT ARRAY['admin', 'manager', 'employee'],
  transcript_access_roles TEXT[] DEFAULT ARRAY['admin', 'manager', 'employee'],
  
  -- Retention policies
  audio_retention_days INTEGER DEFAULT NULL,  -- NULL = keep forever
  transcript_retention_days INTEGER DEFAULT NULL,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);

-- Index for fast lookups
CREATE INDEX idx_enterprise_settings_enterprise_id ON enterprise_settings(enterprise_id);
```

### 2. Update Table: `users`

Add role field for permission checking.

```sql
-- Add role column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'employee';

-- Possible roles: 'admin', 'manager', 'employee', 'guest'
-- Add check constraint
ALTER TABLE users ADD CONSTRAINT check_user_role 
  CHECK (role IN ('admin', 'manager', 'employee', 'guest'));

-- Index for role-based queries
CREATE INDEX idx_users_role ON users(role);
```

### 3. Update Storage RLS Policies

Replace time-limited signed URLs with proper RLS policies that check user authentication and enterprise settings.

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated uploads to audio-recordings" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read their enterprise audio" ON storage.objects;
DROP POLICY IF EXISTS "Allow service role full access to audio-recordings" ON storage.objects;

-- Policy: Allow authenticated users to upload audio files
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio-recordings' AND
  (storage.foldername(name))[1] IN (
    SELECT enterprise_id::text FROM users WHERE auth_id = auth.uid()
  )
);

-- Policy: Allow users to read audio from their own enterprise
CREATE POLICY "Users can read their enterprise audio"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'audio-recordings' AND
  (storage.foldername(name))[1] IN (
    SELECT enterprise_id::text FROM users WHERE auth_id = auth.uid()
  )
);

-- Policy: Service role has full access
CREATE POLICY "Service role full access"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'audio-recordings')
WITH CHECK (bucket_id = 'audio-recordings');
```

## Application Logic Changes

### 1. Audio URL Generation

**Current (temporary):**
- Generate signed URLs with 1-hour expiration
- URLs become invalid after expiration

**New (persistent):**
- Store relative file paths in database (e.g., `enterprise_id/conversation_id/file.webm`)
- Generate authenticated URLs on the client side using Supabase client
- RLS policies handle access control automatically
- URLs remain valid as long as user is authenticated

### 2. Enterprise Settings Service

Create a new service to manage enterprise settings.

**File:** `/lib/db/enterprise-settings.ts`

```typescript
export interface EnterpriseSettings {
  id: number;
  enterprise_id: string;
  enable_audio_recording: boolean;
  enable_message_audio: boolean;
  enable_transcripts: boolean;
  save_transcripts_to_db: boolean;
  audio_access_roles: string[];
  transcript_access_roles: string[];
  audio_retention_days: number | null;
  transcript_retention_days: number | null;
  created_at: string;
  updated_at: string;
}

// Get settings for an enterprise
export async function getEnterpriseSettings(enterpriseId: string): Promise<EnterpriseSettings>

// Update settings (admin only)
export async function updateEnterpriseSettings(enterpriseId: string, settings: Partial<EnterpriseSettings>): Promise<EnterpriseSettings>

// Check if user has audio access
export async function canUserAccessAudio(userId: number, enterpriseId: string): Promise<boolean>

// Check if user has transcript access
export async function canUserAccessTranscripts(userId: number, enterpriseId: string): Promise<boolean>
```

### 3. Permission Checking

Before allowing audio playback or transcript viewing:

```typescript
// Check if recordings are enabled for this enterprise
const settings = await getEnterpriseSettings(enterpriseId);
if (!settings.enable_audio_recording) {
  return { error: 'Audio recording is disabled for this enterprise' };
}

// Check if user has permission to access audio
const hasAccess = await canUserAccessAudio(userId, enterpriseId);
if (!hasAccess) {
  return { error: 'You do not have permission to access audio recordings' };
}
```

### 4. Recording Logic

Update the translation page to check settings before starting recording:

```typescript
// Before starting conversation
const settings = await getEnterpriseSettings(enterpriseId);

if (!settings.enable_audio_recording) {
  // Don't start audio recording
  console.log('Audio recording disabled by enterprise settings');
}

if (!settings.enable_transcripts) {
  // Don't save transcripts to database
  console.log('Transcript saving disabled by enterprise settings');
}
```

## Admin UI Components

### 1. Enterprise Settings Page

**Route:** `/admin/settings`

**Sections:**
- **Recording Settings**
  - Enable/disable audio recording
  - Enable/disable per-message audio
  - Audio retention policy
  
- **Transcript Settings**
  - Enable/disable transcripts
  - Save transcripts to database
  - Transcript retention policy
  
- **Access Control**
  - Define roles that can access audio
  - Define roles that can access transcripts
  
- **Cost Estimate**
  - Show estimated storage costs based on settings
  - Show current storage usage

### 2. User Role Management

**Route:** `/admin/users`

**Features:**
- List all users in enterprise
- Assign roles (admin, manager, employee, guest)
- View audio access permissions per user

## API Endpoints

### 1. Get Enterprise Settings
```
GET /api/admin/settings?enterpriseId={id}
```

### 2. Update Enterprise Settings
```
PUT /api/admin/settings
Body: { enterpriseId, enable_audio_recording, enable_transcripts, ... }
```

### 3. Check Audio Access
```
GET /api/audio/check-access?conversationId={id}
Response: { hasAccess: boolean, reason?: string }
```

### 4. Get User Permissions
```
GET /api/users/permissions?userId={id}
Response: { canAccessAudio: boolean, canAccessTranscripts: boolean }
```

## Security Considerations

1. **Authentication Required**: All audio access requires valid Supabase auth session
2. **RLS Enforcement**: Database-level security prevents unauthorized access
3. **Role Validation**: Backend validates user roles before granting access
4. **Audit Logging**: Track who accesses audio and when (future enhancement)
5. **Enterprise Isolation**: Users can only access audio from their own enterprise

## Migration Strategy

### Phase 1: Database Changes
1. Create `enterprise_settings` table
2. Add `role` column to `users` table
3. Update storage RLS policies
4. Seed default settings for existing enterprises

### Phase 2: Backend Changes
1. Create enterprise settings service
2. Update audio URL generation logic
3. Add permission checking to API endpoints
4. Update recording logic to respect settings

### Phase 3: Frontend Changes
1. Create admin settings UI
2. Update dashboard to use new audio URLs
3. Add permission checks to audio player
4. Show appropriate error messages

### Phase 4: Testing & Rollout
1. Test with different user roles
2. Verify RLS policies work correctly
3. Test recording enable/disable
4. Deploy to production

## Default Settings

For new enterprises:

```javascript
{
  enable_audio_recording: true,
  enable_message_audio: false,
  enable_transcripts: true,
  save_transcripts_to_db: true,
  audio_access_roles: ['admin', 'manager', 'employee'],
  transcript_access_roles: ['admin', 'manager', 'employee'],
  audio_retention_days: null,  // Keep forever
  transcript_retention_days: null
}
```

## Cost Control Benefits

**Disabling Audio Recording:**
- ❌ No audio files uploaded to storage
- ❌ No storage costs for audio
- ✅ Transcripts still available (if enabled)
- ✅ Conversations still tracked

**Disabling Transcripts:**
- ❌ No text saved to database
- ✅ Audio still recorded (if enabled)
- ✅ Real-time translation still works
- ✅ Reduces database storage

**Role-Based Access:**
- Limit audio access to managers and admins only
- Reduce bandwidth costs for audio delivery
- Protect sensitive conversations

## Privacy Benefits

**Enterprise Control:**
- Admins decide what gets recorded
- Admins decide who can access recordings
- Compliance with data protection regulations

**Data Retention:**
- Automatic deletion after retention period
- Reduces long-term privacy risks
- Compliance with GDPR/CCPA

## Future Enhancements

1. **Audit Logging**: Track who accessed which recordings
2. **Encryption**: Encrypt audio files at rest
3. **Watermarking**: Add audio watermarks to prevent unauthorized sharing
4. **Download Control**: Prevent audio downloads for certain roles
5. **Automatic Cleanup**: Delete old recordings based on retention policy
6. **Cost Dashboard**: Real-time storage cost tracking
7. **Per-User Settings**: Override enterprise settings for specific users

## Summary

This design provides comprehensive admin controls for audio recordings and transcripts while ensuring persistent, secure access for authenticated users. The system balances cost control, privacy protection, and user experience through role-based permissions and enterprise-level settings.
