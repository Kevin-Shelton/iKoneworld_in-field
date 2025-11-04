# User Roles Migration Fix Guide

## Problem

The original migration failed with error:
```
ERROR: 22P02: invalid input value for enum user_role: "manager"
```

This indicates that your database already has a `user_role` enum type, but it doesn't include all the values we need (admin, manager, employee, guest).

## Solution

Use the **fixed migration script** that properly handles existing enum types.

## Step-by-Step Fix

### Step 1: Check Current Enum Values

Run this query in Supabase SQL Editor to see what values currently exist:

```sql
SELECT 
    enumlabel as role_value,
    enumsortorder as sort_order
FROM pg_enum 
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;
```

### Step 2: Run the Fixed Migration

Use the file: **`migrations/add-user-roles-fixed.sql`**

This migration will:
- Detect the existing user_role enum
- Add missing values (manager, employee, guest) to the enum
- Handle the role column whether it exists or not
- Convert from VARCHAR to enum if needed
- Set proper defaults and constraints
- Assign first user of each enterprise as admin

### Step 3: Verify the Migration

After running the migration, verify it worked:

```sql
-- Check enum now has all values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;

-- Should show: admin, manager, employee, guest

-- Check users table
SELECT id, email, role, enterprise_id FROM users LIMIT 10;
```

## Recommended Approach

Use the fixed migration (add-user-roles-fixed.sql) because it:
- Preserves existing data
- Adds new enum values safely
- Handles all edge cases
- Provides verification output
- Is non-destructive

## Files Updated

1. migrations/add-user-roles-fixed.sql - Fixed migration script
2. check-enum.sql - Helper query to check enum values
3. MIGRATION_FIX_GUIDE.md - This guide
