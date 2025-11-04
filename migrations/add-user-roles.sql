-- Migration: Add role column to users table
-- Purpose: Enable role-based access control for audio and transcripts
-- Date: 2024-11-04

-- Add role column if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'employee' NOT NULL;

-- Add check constraint for valid roles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_user_role'
  ) THEN
    ALTER TABLE users 
    ADD CONSTRAINT check_user_role 
    CHECK (role IN ('admin', 'manager', 'employee', 'guest'));
  END IF;
END $$;

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create index for enterprise_id lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_enterprise_id ON users(enterprise_id);

-- Add comment to role column
COMMENT ON COLUMN users.role IS 'User role for access control: admin, manager, employee, or guest';

-- Update existing users to have 'employee' role if NULL
UPDATE users SET role = 'employee' WHERE role IS NULL;

-- Set the first user of each enterprise as admin (if no admin exists)
-- This ensures each enterprise has at least one admin
WITH first_users AS (
  SELECT DISTINCT ON (enterprise_id) 
    id, 
    enterprise_id
  FROM users
  WHERE enterprise_id IS NOT NULL
  ORDER BY enterprise_id, created_at ASC
)
UPDATE users
SET role = 'admin'
WHERE id IN (SELECT id FROM first_users)
  AND NOT EXISTS (
    SELECT 1 FROM users u2 
    WHERE u2.enterprise_id = users.enterprise_id 
      AND u2.role = 'admin'
  );
