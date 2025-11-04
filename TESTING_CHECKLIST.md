# Testing Checklist - Enterprise Settings & Audio Permissions

## Pre-Testing Setup

- [ ] All database migrations executed successfully
- [ ] Environment variables configured correctly
- [ ] Development server running without errors
- [ ] At least one admin user exists in the database
- [ ] Default enterprise settings created

## Database Migrations Testing

### Enterprise Settings Table
- [ ] Table `enterprise_settings` exists
- [ ] Default settings inserted for default enterprise
- [ ] RLS policies active on enterprise_settings
- [ ] Can query settings as authenticated user
- [ ] Cannot update settings as non-admin

```sql
-- Test queries
SELECT * FROM enterprise_settings WHERE enterprise_id = '00000000-0000-00';
SELECT policyname FROM pg_policies WHERE tablename = 'enterprise_settings';
```

### User Roles
- [ ] Column `role` added to users table
- [ ] First user of each enterprise set as admin
- [ ] Role constraint enforces valid values
- [ ] Index created on role column

```sql
-- Test queries
SELECT id, email, role, enterprise_id FROM users ORDER BY created_at LIMIT 10;
SELECT COUNT(*) FROM users WHERE role = 'admin';
```

### Storage RLS Policies
- [ ] Old policies dropped successfully
- [ ] New policies created
- [ ] Policies check enterprise_id correctly
- [ ] Authenticated users can read their enterprise audio
- [ ] Users cannot read other enterprise audio

```sql
-- Test queries
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;
```

## API Endpoints Testing

### GET /api/admin/settings
- [ ] Returns settings for valid enterprise ID
- [ ] Returns 400 for missing enterprise ID
- [ ] Returns 500 for invalid enterprise ID
- [ ] Response includes all expected fields

**Test:**
```bash
curl http://localhost:3000/api/admin/settings?enterpriseId=00000000-0000-00
```

### PUT /api/admin/settings
- [ ] Updates settings successfully as admin
- [ ] Returns 403 for non-admin users
- [ ] Returns 400 for missing parameters
- [ ] Updates timestamp correctly
- [ ] Validates role arrays

**Test:**
```bash
curl -X PUT http://localhost:3000/api/admin/settings \
  -H "Content-Type: application/json" \
  -d '{
    "enterpriseId": "00000000-0000-00",
    "userId": 1,
    "enable_audio_recording": false
  }'
```

### GET /api/audio/check-access
- [ ] Returns hasAccess=true for authorized users
- [ ] Returns hasAccess=false for unauthorized users
- [ ] Returns 400 for missing parameters
- [ ] Returns 404 for invalid conversation ID
- [ ] Checks role permissions correctly

## Admin Settings UI Testing

### Page Load
- [ ] Page loads without errors
- [ ] Settings fetch successfully
- [ ] Form populates with current settings
- [ ] Loading state displays correctly
- [ ] Error handling works

### Recording Settings
- [ ] "Enable Audio Recording" toggle works
- [ ] "Enable Per-Message Audio" toggle works
- [ ] Per-message audio disabled when recording disabled
- [ ] Retention days input accepts numbers
- [ ] Retention days can be cleared (null)

### Transcript Settings
- [ ] "Enable Transcripts" toggle works
- [ ] "Save Transcripts to Database" toggle works
- [ ] Save transcripts disabled when transcripts disabled
- [ ] Retention days input accepts numbers
- [ ] Retention days can be cleared (null)

### Access Control
- [ ] All role checkboxes render correctly
- [ ] Can select/deselect audio access roles
- [ ] Can select/deselect transcript access roles
- [ ] Multiple roles can be selected
- [ ] All roles can be deselected (edge case)

### Cost Impact Section
- [ ] Shows correct status for audio recording
- [ ] Shows correct status for transcript storage
- [ ] Shows correct status for retention policy
- [ ] Updates dynamically when settings change

### Save Functionality
- [ ] Save button works
- [ ] Loading state during save
- [ ] Success toast appears
- [ ] Settings persist after save
- [ ] Page can be refreshed without losing changes

### Error Handling
- [ ] Shows error for non-admin users
- [ ] Shows error for network failures
- [ ] Shows error for invalid data
- [ ] Error messages are user-friendly

## Audio Playback Testing

### Dashboard Audio Player
- [ ] Audio player appears for conversations with audio
- [ ] Audio URL generates correctly from file path
- [ ] Audio loads and plays successfully
- [ ] Duration displays correctly
- [ ] Player controls work (play, pause, seek)
- [ ] Audio persists after page refresh
- [ ] Audio works after 1+ hour (no expiration)

### Permission Checks
- [ ] Audio shows for users with permission
- [ ] Audio hidden for users without permission
- [ ] Appropriate message shown when no permission
- [ ] Permission check happens before loading audio

### Multiple Conversations
- [ ] Can play audio from different conversations
- [ ] Switching conversations loads correct audio
- [ ] No audio conflicts between conversations

## Recording Control Testing

### With Recording Enabled
- [ ] Audio recording starts automatically
- [ ] Both employee and customer speech recorded
- [ ] Audio uploads successfully when conversation ends
- [ ] Audio URL saved to database
- [ ] Audio duration calculated correctly

### With Recording Disabled
- [ ] Audio recording does NOT start
- [ ] No audio file uploaded
- [ ] audio_url remains null in database
- [ ] Conversation still works (translation, etc.)
- [ ] No errors in console

### Transcript Control
- [ ] With transcripts enabled: messages saved to DB
- [ ] With transcripts disabled: messages NOT saved
- [ ] Real-time translation still works when disabled
- [ ] No errors when transcript saving disabled

## Role-Based Access Testing

### Admin Role
- [ ] Can access admin settings page
- [ ] Can modify all settings
- [ ] Can access all audio recordings
- [ ] Can view all transcripts

### Manager Role
- [ ] Cannot access admin settings page (or shows read-only)
- [ ] Can access audio (if role included)
- [ ] Can view transcripts (if role included)
- [ ] Cannot modify settings

### Employee Role
- [ ] Cannot access admin settings page
- [ ] Can access audio (if role included)
- [ ] Can view transcripts (if role included)
- [ ] Cannot modify settings

### Guest Role
- [ ] Cannot access admin settings page
- [ ] Cannot access audio (unless explicitly allowed)
- [ ] Cannot view transcripts (unless explicitly allowed)
- [ ] Limited dashboard access

## Edge Cases & Error Scenarios

### Database Errors
- [ ] Handles missing enterprise settings gracefully
- [ ] Creates default settings if none exist
- [ ] Handles database connection errors
- [ ] Shows appropriate error messages

### Storage Errors
- [ ] Handles missing audio files
- [ ] Handles corrupted audio files
- [ ] Shows error when file cannot be accessed
- [ ] Doesn't break dashboard when audio missing

### Authentication Errors
- [ ] Redirects to login when not authenticated
- [ ] Handles expired sessions
- [ ] Refreshes authentication tokens
- [ ] Shows appropriate error messages

### Network Errors
- [ ] Handles API timeouts
- [ ] Retries failed requests
- [ ] Shows loading states
- [ ] Provides retry options

## Performance Testing

### Audio Loading
- [ ] Audio loads within 2 seconds
- [ ] Multiple audio files load efficiently
- [ ] No memory leaks when playing multiple files
- [ ] Browser doesn't freeze during playback

### Settings Page
- [ ] Page loads within 1 second
- [ ] Settings save within 1 second
- [ ] No lag when toggling settings
- [ ] Form is responsive

### Dashboard
- [ ] Conversations list loads quickly
- [ ] Pagination works smoothly
- [ ] Modal opens/closes quickly
- [ ] No performance degradation with many conversations

## Security Testing

### RLS Policies
- [ ] Users can only access their enterprise audio
- [ ] Cannot access other enterprise audio via direct URL
- [ ] Service role bypasses RLS (for backend)
- [ ] Authenticated requirement enforced

### Admin Permissions
- [ ] Non-admins cannot update settings via API
- [ ] Non-admins cannot access admin UI
- [ ] Role validation happens server-side
- [ ] Cannot bypass permissions via client manipulation

### Audio Access
- [ ] File paths cannot be manipulated
- [ ] Cannot access audio without authentication
- [ ] Role checks happen server-side
- [ ] Cannot bypass role restrictions

## Browser Compatibility

### Chrome
- [ ] All features work
- [ ] Audio playback works
- [ ] UI renders correctly

### Firefox
- [ ] All features work
- [ ] Audio playback works
- [ ] UI renders correctly

### Safari
- [ ] All features work
- [ ] Audio playback works
- [ ] UI renders correctly

### Mobile Browsers
- [ ] Responsive design works
- [ ] Touch controls work
- [ ] Audio playback works

## Integration Testing

### End-to-End Flow
1. [ ] Admin disables audio recording
2. [ ] User starts conversation
3. [ ] No audio recorded
4. [ ] Conversation still works
5. [ ] Admin re-enables recording
6. [ ] User starts new conversation
7. [ ] Audio IS recorded
8. [ ] Audio plays in dashboard

### Multi-User Scenario
1. [ ] Admin user creates settings
2. [ ] Manager user views conversation
3. [ ] Employee user views conversation
4. [ ] Guest user denied access
5. [ ] All users see appropriate UI

## Regression Testing

### Existing Features
- [ ] Login/logout still works
- [ ] Profile page still works
- [ ] Language selection still works
- [ ] Translation still works
- [ ] Dashboard still works
- [ ] Conversation list still works

### Backward Compatibility
- [ ] Old conversations without audio_file_path work
- [ ] Old users without roles work (default to employee)
- [ ] Existing audio URLs still work

## Documentation Testing

- [ ] README updated with new features
- [ ] API documentation accurate
- [ ] Migration instructions clear
- [ ] Troubleshooting guide helpful
- [ ] Code comments accurate

## Deployment Checklist

- [ ] All tests passing
- [ ] No console errors
- [ ] No console warnings
- [ ] Database migrations documented
- [ ] Environment variables documented
- [ ] Rollback plan prepared

## Post-Deployment Verification

- [ ] Production database migrations successful
- [ ] Settings page accessible
- [ ] Audio playback works in production
- [ ] No errors in production logs
- [ ] Performance acceptable
- [ ] Users can access features

## Known Issues & Limitations

Document any known issues discovered during testing:

1. 
2. 
3. 

## Test Results Summary

**Date:** ___________
**Tester:** ___________
**Environment:** ___________

**Total Tests:** ___________
**Passed:** ___________
**Failed:** ___________
**Skipped:** ___________

**Critical Issues:** ___________
**Minor Issues:** ___________

**Ready for Production:** [ ] Yes [ ] No

**Notes:**
___________________________________________________________________________
___________________________________________________________________________
___________________________________________________________________________
