-- Add theme preference column to users table
-- This allows users to save their dark/light theme preference

-- Add theme column with default value 'light'
ALTER TABLE users
ADD COLUMN IF NOT EXISTS theme VARCHAR(10) DEFAULT 'light' CHECK (theme IN ('light', 'dark'));

-- Add comment to explain the column
COMMENT ON COLUMN users.theme IS 'User theme preference: light or dark mode';

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name = 'theme';
