-- Migration: Add role column to users table (FIXED VERSION)
-- Purpose: Enable role-based access control for audio and transcripts
-- Date: 2024-11-04
-- Note: This version handles existing user_role enum type

-- Step 1: Check if user_role enum exists and what values it has
-- Run this query first to see what we're working with:
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role'::regtype;

-- Step 2: Handle the enum type
DO $$ 
BEGIN
  -- Check if user_role enum exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    -- Enum exists, check if it has the values we need
    -- If not, we need to add them
    
    -- Add 'manager' if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumtypid = 'user_role'::regtype 
      AND enumlabel = 'manager'
    ) THEN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';
    END IF;
    
    -- Add 'employee' if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumtypid = 'user_role'::regtype 
      AND enumlabel = 'employee'
    ) THEN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'employee';
    END IF;
    
    -- Add 'guest' if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumtypid = 'user_role'::regtype 
      AND enumlabel = 'guest'
    ) THEN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'guest';
    END IF;
    
    RAISE NOTICE 'Updated existing user_role enum with new values';
  ELSE
    -- Enum doesn't exist, create it
    CREATE TYPE user_role AS ENUM ('admin', 'manager', 'employee', 'guest');
    RAISE NOTICE 'Created new user_role enum';
  END IF;
END $$;

-- Step 3: Add role column if it doesn't exist
-- First, check if column exists and what type it is
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    -- Column exists, check if it's the right type
    DECLARE
      col_type text;
    BEGIN
      SELECT udt_name INTO col_type
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'role';
      
      IF col_type = 'varchar' OR col_type = 'text' THEN
        -- It's a string type, we need to convert it
        RAISE NOTICE 'Role column exists as %, converting to enum', col_type;
        
        -- First, update any existing values to match enum
        UPDATE users SET role = 'employee' WHERE role IS NULL OR role = '';
        UPDATE users SET role = 'admin' WHERE role NOT IN ('admin', 'manager', 'employee', 'guest');
        
        -- Drop the constraint if it exists
        ALTER TABLE users DROP CONSTRAINT IF EXISTS check_user_role;
        
        -- Change column type to enum
        ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role;
        ALTER TABLE users ALTER COLUMN role SET DEFAULT 'employee'::user_role;
        ALTER TABLE users ALTER COLUMN role SET NOT NULL;
      ELSIF col_type = 'user_role' THEN
        RAISE NOTICE 'Role column already exists with correct type';
      END IF;
    END;
  ELSE
    -- Column doesn't exist, add it
    ALTER TABLE users ADD COLUMN role user_role DEFAULT 'employee'::user_role NOT NULL;
    RAISE NOTICE 'Added role column to users table';
  END IF;
END $$;

-- Step 4: Create index for role-based queries if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Step 5: Create index for enterprise_id lookups if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_users_enterprise_id ON users(enterprise_id);

-- Step 6: Add comment to role column
COMMENT ON COLUMN users.role IS 'User role for access control: admin, manager, employee, or guest';

-- Step 7: Update existing users to have 'employee' role if NULL
UPDATE users SET role = 'employee'::user_role WHERE role IS NULL;

-- Step 8: Set the first user of each enterprise as admin (if no admin exists)
WITH first_users AS (
  SELECT DISTINCT ON (enterprise_id) 
    id, 
    enterprise_id
  FROM users
  WHERE enterprise_id IS NOT NULL
  ORDER BY enterprise_id, created_at ASC
)
UPDATE users
SET role = 'admin'::user_role
WHERE id IN (SELECT id FROM first_users)
  AND NOT EXISTS (
    SELECT 1 FROM users u2 
    WHERE u2.enterprise_id = users.enterprise_id 
      AND u2.role = 'admin'::user_role
  );

-- Step 9: Verify the migration
DO $$
DECLARE
  enum_count integer;
  role_count integer;
  admin_count integer;
BEGIN
  -- Count enum values
  SELECT COUNT(*) INTO enum_count
  FROM pg_enum 
  WHERE enumtypid = 'user_role'::regtype;
  
  -- Count users with roles
  SELECT COUNT(*) INTO role_count
  FROM users 
  WHERE role IS NOT NULL;
  
  -- Count admins
  SELECT COUNT(*) INTO admin_count
  FROM users 
  WHERE role = 'admin'::user_role;
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  - user_role enum has % values', enum_count;
  RAISE NOTICE '  - % users have roles assigned', role_count;
  RAISE NOTICE '  - % users are admins', admin_count;
END $$;
