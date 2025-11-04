# Migration Order - Quick Reference

## The Problem

PostgreSQL requires enum values to be **committed in a separate transaction** before they can be used. This is why the migration was split into two parts.

## Correct Migration Order

### Step 1: Add Enum Values (Part 1)

**File:** `migrations/add-organization-roles-part1.sql`

**What it does:**
- Adds 8 new role values to the `user_role` enum
- Does NOT use the new values yet

**Run in Supabase SQL Editor:**
```sql
-- Copy and paste the entire contents of:
-- migrations/add-organization-roles-part1.sql
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
Part 1 Complete!
```

**⚠️ IMPORTANT:** Wait for this to complete and commit before proceeding.

---

### Step 2: Use Enum Values (Part 2)

**File:** `migrations/add-organization-roles-part2.sql`

**What it does:**
- Creates/updates the `role` column
- Syncs `enterprise_role` to `role`
- Converts legacy roles
- Sets first user as enterprise_admin
- Creates indexes

**Run in Supabase SQL Editor:**
```sql
-- Copy and paste the entire contents of:
-- migrations/add-organization-roles-part2.sql
```

**Expected output:**
```
✓ Added role column to users table
✓ Synced enterprise_role to role for X users
✓ Converted X admin users to enterprise_admin
✓ Promoted X first users to enterprise_admin
✓ Created indexes for role-based queries
Part 2 Complete!
```

---

### Step 3: Create Enterprise Settings

**File:** `migrations/create-enterprise-settings-org-roles.sql`

**What it does:**
- Creates the `enterprise_settings` table
- Sets up default role permissions
- Enables RLS policies

**Run in Supabase SQL Editor:**
```sql
-- Copy and paste the entire contents of:
-- migrations/create-enterprise-settings-org-roles.sql
```

**Expected output:**
```
Enterprise Settings Migration Complete!
Settings created: 1
Default audio roles: enterprise_admin, regional_director, ...
```

---

### Step 4: Update Storage RLS Policies

**File:** `migrations/update-storage-rls-policies.sql`

**What it does:**
- Updates storage RLS policies for persistent audio access

**Run in Supabase SQL Editor:**
```sql
-- Copy and paste the entire contents of:
-- migrations/update-storage-rls-policies.sql
```

---

## Summary

**Total: 4 migrations in this order:**

1. ✅ `add-organization-roles-part1.sql` - Add enum values
2. ✅ `add-organization-roles-part2.sql` - Use enum values
3. ✅ `create-enterprise-settings-org-roles.sql` - Create settings
4. ✅ `update-storage-rls-policies.sql` - Update storage

**Each migration must complete successfully before running the next one.**

## Verification

After all migrations, run this query:

```sql
-- Check enum values
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;

-- Check user roles
SELECT role, COUNT(*) as count
FROM users
GROUP BY role
ORDER BY count DESC;

-- Check enterprise settings
SELECT enterprise_id, audio_access_roles, transcript_access_roles
FROM enterprise_settings;
```

## Rollback (If Needed)

If something goes wrong, you can rollback:

```sql
-- Drop enterprise settings table
DROP TABLE IF EXISTS enterprise_settings CASCADE;

-- Reset user roles to original
UPDATE users SET role = 'user'::user_role WHERE role = 'retail_staff'::user_role;
UPDATE users SET role = 'admin'::user_role WHERE role = 'enterprise_admin'::user_role;

-- Note: Cannot remove enum values once added
-- They will remain but won't be used
```

## Common Issues

### Issue: "unsafe use of new value"

**Cause:** Trying to use enum value in same transaction it was created.

**Solution:** Run part 1 first, wait for it to commit, then run part 2.

### Issue: "enum label already exists"

**Cause:** Running part 1 multiple times.

**Solution:** This is fine - the migration checks and skips existing values.

### Issue: "column role does not exist"

**Cause:** Part 2 hasn't been run yet.

**Solution:** Run part 2 migration.

## Next Steps

After migrations complete:

1. ✅ Test admin settings page at `/admin/settings`
2. ✅ Verify you see 8 role options
3. ✅ Test toggling roles and saving
4. ✅ Test audio playback in dashboard
5. ✅ Verify permissions work correctly
