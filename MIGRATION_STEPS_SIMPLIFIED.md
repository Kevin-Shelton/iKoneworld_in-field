# Simplified Migration Steps (For Existing 'user' and 'admin' Roles)

## Your Current Setup

Your database has a `user_role` enum with only two values:
- `admin` - Administrator role
- `user` - Regular user role

## Two Options

### Option 1: Keep It Simple (Recommended)

Use only your existing two roles and simplify the permission system.

**Advantages:**
- ✅ No enum changes needed
- ✅ Simpler permission model
- ✅ Less complexity
- ✅ Works immediately

**How it works:**
- `admin` = Full access to everything + can modify settings
- `user` = Can access audio and transcripts (unless admin restricts)

### Option 2: Add New Roles

Add 'manager', 'employee', and 'guest' to the enum for more granular control.

**Advantages:**
- ✅ More granular permissions
- ✅ Can distinguish between managers and employees
- ✅ Guest role for limited access

**Disadvantages:**
- ⚠️ Requires enum modification
- ⚠️ More complex permission logic

## Recommended: Option 1 (Simple Two-Role System)

### Step 1: Run Enterprise Settings Migration

Use the **updated** enterprise settings migration:

**File:** `migrations/create-enterprise-settings-updated.sql`

This version uses only 'admin' and 'user' roles:
```sql
audio_access_roles = ARRAY['admin', 'user']
transcript_access_roles = ARRAY['admin', 'user']
```

### Step 2: Skip the User Roles Migration

You don't need to run `add-user-roles.sql` or `add-user-roles-fixed.sql` because your users table already has the role column with the correct enum type.

### Step 3: Run Storage RLS Migration

**File:** `migrations/update-storage-rls-policies.sql`

This works with any role values, so no changes needed.

### Step 4: Update Code to Use Two Roles

The admin settings UI needs to be updated to only show 'admin' and 'user' options.

## If You Choose Option 2 (Add New Roles)

### Step 1: Run the Fixed User Roles Migration

**File:** `migrations/add-user-roles-fixed.sql`

This will add 'manager', 'employee', and 'guest' to your enum.

### Step 2: Run Original Enterprise Settings Migration

**File:** `migrations/create-enterprise-settings.sql`

This uses all four roles: admin, manager, employee, guest.

### Step 3: Run Storage RLS Migration

**File:** `migrations/update-storage-rls-policies.sql`

## Migration Order (Option 1 - Recommended)

```
1. create-enterprise-settings-updated.sql  ✅ Use this one
2. update-storage-rls-policies.sql         ✅ No changes needed
3. Update admin UI code                     ✅ See below
```

## Migration Order (Option 2)

```
1. add-user-roles-fixed.sql                ✅ Adds new enum values
2. create-enterprise-settings.sql          ✅ Original version
3. update-storage-rls-policies.sql         ✅ No changes needed
```

## Code Changes for Option 1 (Two Roles)

### Update Admin Settings Page

**File:** `app/admin/settings/page.tsx`

Change this line:
```typescript
const AVAILABLE_ROLES = ['admin', 'manager', 'employee', 'guest'];
```

To:
```typescript
const AVAILABLE_ROLES = ['admin', 'user'];
```

### Update Enterprise Settings Service

**File:** `lib/db/enterprise-settings.ts`

Change default values:
```typescript
audio_access_roles: ['admin', 'user'],
transcript_access_roles: ['admin', 'user'],
```

### Update Admin Settings API

**File:** `app/api/admin/settings/route.ts`

No changes needed - it works with any role values.

## Testing After Migration

### Test 1: Check Enterprise Settings

```sql
SELECT 
  enterprise_id,
  enable_audio_recording,
  enable_transcripts,
  audio_access_roles,
  transcript_access_roles
FROM enterprise_settings;
```

Should show:
```
audio_access_roles: {admin,user}
transcript_access_roles: {admin,user}
```

### Test 2: Check User Roles

```sql
SELECT 
  id,
  email,
  role,
  enterprise_id
FROM users
LIMIT 10;
```

Should show roles as either 'admin' or 'user'.

### Test 3: Access Admin Settings Page

1. Navigate to `/admin/settings`
2. Should see only two role options: Admin and User
3. Toggle settings and save
4. Verify settings persist

## Which Option Should You Choose?

### Choose Option 1 (Two Roles) if:
- ✅ You want simplicity
- ✅ You don't need granular permissions
- ✅ Admin vs non-admin is sufficient
- ✅ You want to deploy quickly

### Choose Option 2 (Four Roles) if:
- ✅ You need manager role separate from employees
- ✅ You want guest access with restrictions
- ✅ You need fine-grained permission control
- ✅ You're okay with more complexity

## My Recommendation

**Start with Option 1 (Two Roles)** because:
1. It works with your existing database
2. It's simpler to implement and maintain
3. You can always add more roles later if needed
4. Most organizations only need admin vs non-admin

You can always run the `add-user-roles-fixed.sql` migration later to add more roles if you find you need them.

## Next Steps

1. **Decide:** Option 1 (simple) or Option 2 (granular)
2. **Run migrations** in the correct order
3. **Update code** if using Option 1
4. **Test** the admin settings page
5. **Verify** audio playback works

Let me know which option you'd like to proceed with, and I can provide the exact files and steps you need!
