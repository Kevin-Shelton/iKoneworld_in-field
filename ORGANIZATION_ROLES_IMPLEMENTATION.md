# Organization-Aligned Roles Implementation Guide

## Overview

This guide provides complete instructions for implementing organization-aligned user roles that match your enterprise hierarchy structure.

## Your Organization Structure

Your application has a comprehensive hierarchical structure:

```
Enterprise → Region → State → City → District → Store → Department
```

With corresponding management roles at each level.

## New Role System

### 8 Organization-Aligned Roles

1. **enterprise_admin** - Top-level administrator with full system access
2. **regional_director** - Manages regions and has regional oversight
3. **area_manager** - Manages states/areas within regions
4. **district_manager** - Manages districts within cities
5. **store_manager** - Manages individual store locations
6. **field_sales** - Field sales representatives
7. **retail_staff** - Store employees and front-line staff
8. **viewer** - Read-only access for reporting/analytics

## Migration Steps

### Step 1: Add Organization Roles to Enum

**File:** `migrations/add-organization-roles.sql`

This migration will:
- Add all 8 organization roles to the `user_role` enum
- Sync existing `enterprise_role` values to `role` column
- Convert legacy 'admin' to 'enterprise_admin'
- Convert legacy 'user' to 'retail_staff'
- Set first user of each enterprise as enterprise_admin
- Create necessary indexes

**Run this migration:**
```sql
-- In Supabase SQL Editor, execute:
-- migrations/add-organization-roles.sql
```

**Expected output:**
```
✓ Added enterprise_admin
✓ Added regional_director
✓ Added area_manager
✓ Added district_manager
✓ Added store_manager
✓ Added field_sales
✓ Added retail_staff
✓ Added viewer
Synced enterprise_role to role for X users
Converted X admin users to enterprise_admin
Converted X generic users to retail_staff
Migration Complete!
Enum values: 10
Users with roles: X
Enterprise admins: X
```

### Step 2: Create Enterprise Settings

**File:** `migrations/create-enterprise-settings-org-roles.sql`

This migration will:
- Create the `enterprise_settings` table
- Set default audio access for all roles except viewer
- Set default transcript access for all roles including viewer
- Enable RLS policies
- Create default settings for enterprise '00000000-0000-00'

**Run this migration:**
```sql
-- In Supabase SQL Editor, execute:
-- migrations/create-enterprise-settings-org-roles.sql
```

**Expected output:**
```
Enterprise Settings Migration Complete!
Settings created: 1
Default audio roles: enterprise_admin, regional_director, area_manager, district_manager, store_manager, field_sales, retail_staff
Default transcript roles: enterprise_admin, regional_director, area_manager, district_manager, store_manager, field_sales, retail_staff, viewer
```

### Step 3: Update Storage RLS Policies

**File:** `migrations/update-storage-rls-policies.sql`

This migration enables persistent authenticated access to audio files.

**Run this migration:**
```sql
-- In Supabase SQL Editor, execute:
-- migrations/update-storage-rls-policies.sql
```

## Verification

### Verify Enum Values

```sql
SELECT enumlabel, enumsortorder
FROM pg_enum 
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;
```

**Expected result:**
```
enumlabel          | enumsortorder
-------------------+--------------
user               | 1
admin              | 2
enterprise_admin   | 3
regional_director  | 4
area_manager       | 5
district_manager   | 6
store_manager      | 7
field_sales        | 8
retail_staff       | 9
viewer             | 10
```

### Verify User Roles

```sql
SELECT 
  id,
  email,
  role,
  enterprise_role,
  enterprise_id
FROM users
ORDER BY role
LIMIT 20;
```

### Verify Enterprise Settings

```sql
SELECT 
  enterprise_id,
  enable_audio_recording,
  enable_transcripts,
  audio_access_roles,
  transcript_access_roles
FROM enterprise_settings;
```

## Code Updates

All necessary code files have been updated:

### 1. Admin Settings Page
**File:** `app/admin/settings/page.tsx`

- ✅ Updated to show all 8 roles with descriptions
- ✅ Role checkboxes now display role labels and descriptions
- ✅ Better visual layout for role selection

### 2. Enterprise Settings Service
**File:** `lib/db/enterprise-settings.ts`

- ✅ Updated default role arrays
- ✅ Admin check now includes both 'enterprise_admin' and 'admin'
- ✅ Permission checks work with new roles

### 3. Dashboard (Already Updated)
**File:** `app/dashboard/page.tsx`

- ✅ Uses authenticated audio URLs
- ✅ Permission checks work with any role

## Testing the Implementation

### Test 1: Admin Settings Page

1. Navigate to `/admin/settings`
2. Verify you see 8 role options with descriptions:
   - Enterprise Admin
   - Regional Director
   - Area Manager
   - District Manager
   - Store Manager
   - Field Sales
   - Retail Staff
   - Viewer
3. Toggle different roles for audio access
4. Toggle different roles for transcript access
5. Save settings
6. Refresh page and verify settings persisted

### Test 2: Role-Based Audio Access

1. Create test users with different roles
2. Create conversations with audio
3. Log in as each user
4. Verify audio access based on role:
   - enterprise_admin: ✅ Full access
   - regional_director: ✅ Full access
   - store_manager: ✅ Full access
   - retail_staff: ✅ Access (if enabled)
   - viewer: ❌ No access (unless enabled)

### Test 3: Settings Restrictions

1. Log in as enterprise_admin
2. Disable audio recording
3. Log in as retail_staff
4. Start a conversation
5. Verify no audio is recorded
6. Re-enable as admin
7. Verify audio recording resumes

## Role Permission Matrix

### Default Audio Access

| Role | Access | Rationale |
|------|--------|-----------|
| enterprise_admin | ✅ Yes | Full system access |
| regional_director | ✅ Yes | Regional oversight needs |
| area_manager | ✅ Yes | Area performance monitoring |
| district_manager | ✅ Yes | District quality assurance |
| store_manager | ✅ Yes | Store operations and training |
| field_sales | ✅ Yes | Review own conversations |
| retail_staff | ✅ Yes | Review own conversations |
| viewer | ❌ No | Read-only, no audio access |

### Default Transcript Access

| Role | Access | Rationale |
|------|--------|-----------|
| enterprise_admin | ✅ Yes | Full system access |
| regional_director | ✅ Yes | Regional analysis |
| area_manager | ✅ Yes | Area performance |
| district_manager | ✅ Yes | District quality |
| store_manager | ✅ Yes | Store training |
| field_sales | ✅ Yes | Review own transcripts |
| retail_staff | ✅ Yes | Review own transcripts |
| viewer | ✅ Yes | Analytics and reporting |

### Settings Management

| Role | Can Modify | Scope |
|------|-----------|-------|
| enterprise_admin | ✅ Yes | Enterprise-wide |
| All others | ❌ No | View only |

## Customizing Permissions

Admins can customize which roles have access through the admin settings page:

### Example: Restrict Audio to Management Only

1. Go to `/admin/settings`
2. Under "Audio Access Roles", uncheck:
   - Field Sales
   - Retail Staff
3. Keep checked:
   - Enterprise Admin
   - Regional Director
   - Area Manager
   - District Manager
   - Store Manager
4. Save settings

Now only management-level roles can access audio recordings.

### Example: Give Viewers Audio Access

1. Go to `/admin/settings`
2. Under "Audio Access Roles", check:
   - Viewer
3. Save settings

Now viewers can access audio for analytics purposes.

## Future Enhancements

### Hierarchical Data Access

Implement scope-based filtering so users only see data from their organizational level:

```typescript
// Example: Regional director sees only their region
if (user.role === 'regional_director') {
  const conversations = await getConversationsByRegion(user.region_id);
}

// Example: Store manager sees only their store
if (user.role === 'store_manager') {
  const conversations = await getConversationsByStore(user.store_id);
}
```

### Regional Settings Override

Allow regional directors to override enterprise settings for their region:

```typescript
interface RegionalSettings extends EnterpriseSettings {
  region_id: string;
  overrides_enterprise: boolean;
}
```

### Role Hierarchy Inheritance

Implement automatic permission inheritance:

```typescript
const ROLE_HIERARCHY = {
  enterprise_admin: 8,
  regional_director: 7,
  area_manager: 6,
  district_manager: 5,
  store_manager: 4,
  field_sales: 2,
  retail_staff: 2,
  viewer: 1,
};

function hasHigherRole(userRole: string, requiredRole: string): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
```

## Troubleshooting

### Issue: Enum value already exists

**Cause:** Running migration multiple times.

**Solution:** This is fine - the migration uses `IF NOT EXISTS` logic and will skip existing values.

### Issue: User role is NULL

**Cause:** User created before migration ran.

**Solution:** Run this query:
```sql
UPDATE users SET role = 'retail_staff'::user_role WHERE role IS NULL;
```

### Issue: Can't access admin settings

**Cause:** User doesn't have enterprise_admin role.

**Solution:** Grant admin role:
```sql
UPDATE users SET role = 'enterprise_admin'::user_role WHERE email = 'your-email@example.com';
```

### Issue: Audio still doesn't play

**Cause:** RLS policies not updated.

**Solution:** Ensure you ran `update-storage-rls-policies.sql` migration.

## Summary

This implementation provides:

✅ **8 organization-aligned roles** matching your business structure  
✅ **Granular permission control** for audio and transcripts  
✅ **Admin settings UI** with role descriptions  
✅ **Backward compatibility** with existing 'admin' and 'user' roles  
✅ **Persistent audio access** for authenticated users  
✅ **Flexible permissions** - admins can customize per role  
✅ **Scalable architecture** for future hierarchical features  

The system is production-ready and can be deployed after running the three migrations and testing in your environment.

## Files Delivered

### Migrations (3 files)
1. `migrations/add-organization-roles.sql` - Adds 8 roles to enum
2. `migrations/create-enterprise-settings-org-roles.sql` - Creates settings table
3. `migrations/update-storage-rls-policies.sql` - Enables persistent audio access

### Documentation (2 files)
4. `ORGANIZATION_ROLES_DESIGN.md` - Comprehensive design document
5. `ORGANIZATION_ROLES_IMPLEMENTATION.md` - This implementation guide

### Code Updates (2 files)
6. `app/admin/settings/page.tsx` - Updated UI with 8 roles
7. `lib/db/enterprise-settings.ts` - Updated default values

All files are ready for deployment!
