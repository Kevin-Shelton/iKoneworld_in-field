-- Add default_language field to users table
-- This allows users to set their preferred language for conversations

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS default_language VARCHAR(16);

-- Add comment to explain the field
COMMENT ON COLUMN users.default_language IS 'User preferred language code for conversations (e.g., en-US, es-ES)';
