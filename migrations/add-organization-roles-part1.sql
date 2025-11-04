-- Migration Part 1: Add organization-aligned roles to user_role enum
-- Purpose: Add new enum values (must be committed before use)
-- Date: 2024-11-04
-- IMPORTANT: Run this FIRST, then run part 2 in a separate transaction

-- ============================================================================
-- Add new role values to user_role enum
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE 'Adding organization-aligned roles to user_role enum...';
  RAISE NOTICE 'This is Part 1 - adding enum values only';
  RAISE NOTICE '';
  
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
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Part 1 Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Enum values have been added.';
  RAISE NOTICE 'NEXT STEP: Run part 2 migration';
  RAISE NOTICE '========================================';
  
END $$;

-- Display current enum values
DO $$
DECLARE
  role_list text;
BEGIN
  SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder) INTO role_list
  FROM pg_enum 
  WHERE enumtypid = 'user_role'::regtype;
  
  RAISE NOTICE 'Available roles: %', role_list;
END $$;
