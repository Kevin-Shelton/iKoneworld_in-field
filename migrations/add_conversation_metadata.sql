-- Add metadata column to conversations table for demo chat support
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add comment to explain the column
COMMENT ON COLUMN conversations.metadata IS 'JSON metadata including {is_demo: true} for demo conversations';
