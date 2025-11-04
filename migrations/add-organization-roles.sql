-- Migration: Add organization-aligned roles to user_role enum
-- Purpose: Align user_role with enterprise_role for hierarchical permissions
-- Date: 2024-11-04
-- Note: Adds enterprise organizational roles to existing user_role enum

-- ============================================================================
-- STEP 1: Add new role values to user_role enum
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE 'Adding organization-aligned roles to user_role enum...';
  
  -- Add enterprise_admin (top-level administrator)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'user_role'::regtype 
    AND enumlabel = 'enterprise_admin'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'enterprise_admin';
    RAISE NOTICE '  ✓ Added enterprise_admin';
  ELSE
    RAISE NOTICE '  - enterprise_admin already exists';
  END IF;
  
  -- Add regional_director (manages regions)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'user_role'::regtype 
    AND enumlabel = 'regional_director'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'regional_director';
    RAISE NOTICE '  ✓ Added regional_director';
  ELSE
    RAISE NOTICE '  - regional_director already exists';
  END IF;
  
  -- Add area_manager (manages states/areas)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'user_role'::regtype 
    AND enumlabel = 'area_manager'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'area_manager';
    RAISE NOTICE '  ✓ Added area_manager';
  ELSE
    RAISE NOTICE '  - area_manager already exists';
  END IF;
  
  -- Add district_manager (manages districts)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'user_role'::regtype 
    AND enumlabel = 'district_manager'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'district_manager';
    RAISE NOTICE '  ✓ Added district_manager';
  ELSE
    RAISE NOTICE '  - district_manager already exists';
  END IF;
  
  -- Add store_manager (manages stores)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'user_role'::regtype 
    AND enumlabel = 'store_manager'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'store_manager';
    RAISE NOTICE '  ✓ Added store_manager';
  ELSE
    RAISE NOTICE '  - store_manager already exists';
  END IF;
  
  -- Add field_sales (field sales representatives)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'user_role'::regtype 
    AND enumlabel = 'field_sales'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'field_sales';
    RAISE NOTICE '  ✓ Added field_sales';
  ELSE
    RAISE NOTICE '  - field_sales already exists';
  END IF;
  
  -- Add retail_staff (store employees)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'user_role'::regtype 
    AND enumlabel = 'retail_staff'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'retail_staff';
    RAISE NOTICE '  ✓ Added retail_staff';
  ELSE
    RAISE NOTICE '  - retail_staff already exists';
  END IF;
  
  -- Add viewer (read-only access)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'user_role'::regtype 
    AND enumlabel = 'viewer'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'viewer';
    RAISE NOTICE '  ✓ Added viewer';
  ELSE
    RAISE NOTICE '  - viewer already exists';
  END IF;
  
END $$;

-- ============================================================================
-- STEP 2: Ensure role column exists with correct type
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    -- Column doesn't exist, add it
    ALTER TABLE users ADD COLUMN role user_role DEFAULT 'retail_staff'::user_role NOT NULL;
    RAISE NOTICE 'Added role column to users table';
  ELSE
    -- Column exists, ensure it has proper default
    ALTER TABLE users ALTER COLUMN role SET DEFAULT 'retail_staff'::user_role;
    ALTER TABLE users ALTER COLUMN role SET NOT NULL;
    RAISE NOTICE 'Updated role column defaults';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Sync enterprise_role to role for existing users
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
    RAISE NOTICE 'Synced enterprise_role to role for % users', updated_count;
  ELSE
    RAISE NOTICE 'enterprise_role column not found, skipping sync';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Handle backward compatibility (admin -> enterprise_admin)
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
    RAISE NOTICE 'Converted % admin users to enterprise_admin', admin_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Handle backward compatibility (user -> retail_staff)
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
    RAISE NOTICE 'Converted % generic users to retail_staff', user_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Set first user of each enterprise as enterprise_admin
-- ============================================================================

WITH first_users AS (
  SELECT DISTINCT ON (enterprise_id) 
    id, 
    enterprise_id
  FROM users
  WHERE enterprise_id IS NOT NULL
  ORDER BY enterprise_id, created_at ASC
)
UPDATE users
SET role = 'enterprise_admin'::user_role
WHERE id IN (SELECT id FROM first_users)
  AND NOT EXISTS (
    SELECT 1 FROM users u2 
    WHERE u2.enterprise_id = users.enterprise_id 
      AND u2.role = 'enterprise_admin'::user_role
  );

-- ============================================================================
-- STEP 7: Create indexes for role-based queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_enterprise_role ON users(enterprise_id, role);

-- ============================================================================
-- STEP 8: Add helpful comments
-- ============================================================================

COMMENT ON COLUMN users.role IS 'User role for access control - aligned with organizational hierarchy';

-- ============================================================================
-- STEP 9: Verify the migration
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
  RAISE NOTICE 'Migration Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Enum values: %', enum_count;
  RAISE NOTICE 'Users with roles: %', role_count;
  RAISE NOTICE 'Enterprise admins: %', admin_count;
  RAISE NOTICE 'Role distribution: %', role_distribution;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- STEP 10: Display current enum values
-- ============================================================================

DO $$
DECLARE
  role_list text;
BEGIN
  SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder) INTO role_list
  FROM pg_enum 
  WHERE enumtypid = 'user_role'::regtype;
  
  RAISE NOTICE 'Available roles: %', role_list;
END $$;
