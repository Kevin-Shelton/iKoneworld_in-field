-- Migration Part 2: Use organization-aligned roles
-- Purpose: Update users table and sync roles
-- Date: 2024-11-04
-- IMPORTANT: Run this AFTER part 1 has been committed

-- ============================================================================
-- STEP 1: Ensure role column exists with correct type
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE 'Starting Part 2: Using organization-aligned roles...';
  RAISE NOTICE '';
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    -- Column doesn't exist, add it
    ALTER TABLE users ADD COLUMN role user_role DEFAULT 'retail_staff'::user_role NOT NULL;
    RAISE NOTICE '✓ Added role column to users table';
  ELSE
    -- Column exists, ensure it has proper default
    ALTER TABLE users ALTER COLUMN role SET DEFAULT 'retail_staff'::user_role;
    ALTER TABLE users ALTER COLUMN role SET NOT NULL;
    RAISE NOTICE '✓ Updated role column defaults';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Sync enterprise_role to role for existing users
-- ============================================================================

DO $$
DECLARE
  updated_count integer := 0;
BEGIN
  -- Check if enterprise_role column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'enterprise_role'
  ) THEN
    -- Sync enterprise_role to role
    UPDATE users 
    SET role = enterprise_role::text::user_role
    WHERE enterprise_role IS NOT NULL
      AND (role IS NULL OR role != enterprise_role::text::user_role);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✓ Synced enterprise_role to role for % users', updated_count;
  ELSE
    RAISE NOTICE '- enterprise_role column not found, skipping sync';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Handle backward compatibility (admin -> enterprise_admin)
-- ============================================================================

DO $$
DECLARE
  admin_count integer := 0;
BEGIN
  -- Convert 'admin' to 'enterprise_admin' for clarity
  UPDATE users 
  SET role = 'enterprise_admin'::user_role
  WHERE role = 'admin'::user_role;
  
  GET DIAGNOSTICS admin_count = ROW_COUNT;
  
  IF admin_count > 0 THEN
    RAISE NOTICE '✓ Converted % admin users to enterprise_admin', admin_count;
  ELSE
    RAISE NOTICE '- No admin users to convert';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Handle backward compatibility (user -> retail_staff)
-- ============================================================================

DO $$
DECLARE
  user_count integer := 0;
BEGIN
  -- Convert generic 'user' to 'retail_staff' for clarity
  UPDATE users 
  SET role = 'retail_staff'::user_role
  WHERE role = 'user'::user_role;
  
  GET DIAGNOSTICS user_count = ROW_COUNT;
  
  IF user_count > 0 THEN
    RAISE NOTICE '✓ Converted % generic users to retail_staff', user_count;
  ELSE
    RAISE NOTICE '- No generic users to convert';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Set first user of each enterprise as enterprise_admin
-- ============================================================================

DO $$
DECLARE
  promoted_count integer := 0;
BEGIN
  WITH first_users AS (
    SELECT DISTINCT ON (enterprise_id) 
      id, 
      enterprise_id
    FROM users
    WHERE enterprise_id IS NOT NULL
    ORDER BY enterprise_id, "createdAt" ASC
  )
  UPDATE users
  SET role = 'enterprise_admin'::user_role
  WHERE id IN (SELECT id FROM first_users)
    AND NOT EXISTS (
      SELECT 1 FROM users u2 
      WHERE u2.enterprise_id = users.enterprise_id 
        AND u2.role = 'enterprise_admin'::user_role
    );
  
  GET DIAGNOSTICS promoted_count = ROW_COUNT;
  
  IF promoted_count > 0 THEN
    RAISE NOTICE '✓ Promoted % first users to enterprise_admin', promoted_count;
  ELSE
    RAISE NOTICE '- All enterprises already have admins';
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Create indexes for role-based queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_enterprise_role ON users(enterprise_id, role);

-- ============================================================================
-- STEP 7: Add helpful comments
-- ============================================================================

COMMENT ON COLUMN users.role IS 'User role for access control - aligned with organizational hierarchy';

DO $$
BEGIN
  RAISE NOTICE '✓ Created indexes for role-based queries';
  RAISE NOTICE '✓ Added column comments';
END $$;

-- ============================================================================
-- STEP 8: Verify the migration
-- ============================================================================

DO $$
DECLARE
  enum_count integer;
  role_count integer;
  admin_count integer;
  role_distribution jsonb;
BEGIN
  -- Count enum values
  SELECT COUNT(*) INTO enum_count
  FROM pg_enum 
  WHERE enumtypid = 'user_role'::regtype;
  
  -- Count users with roles
  SELECT COUNT(*) INTO role_count
  FROM users 
  WHERE role IS NOT NULL;
  
  -- Count enterprise admins
  SELECT COUNT(*) INTO admin_count
  FROM users 
  WHERE role = 'enterprise_admin'::user_role;
  
  -- Get role distribution
  SELECT jsonb_object_agg(role, count) INTO role_distribution
  FROM (
    SELECT role::text, COUNT(*) as count
    FROM users
    GROUP BY role
    ORDER BY count DESC
  ) role_counts;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Part 2 Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Enum values: %', enum_count;
  RAISE NOTICE 'Users with roles: %', role_count;
  RAISE NOTICE 'Enterprise admins: %', admin_count;
  RAISE NOTICE 'Role distribution: %', role_distribution;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- STEP 9: Display current enum values
-- ============================================================================

DO $$
DECLARE
  role_list text;
BEGIN
  SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder) INTO role_list
  FROM pg_enum 
  WHERE enumtypid = 'user_role'::regtype;
  
  RAISE NOTICE 'Available roles: %', role_list;
  RAISE NOTICE '';
  RAISE NOTICE 'Migration complete! You can now run the enterprise settings migration.';
END $$;
