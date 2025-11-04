-- Simple migration to add audio fields to conversations table
-- Run this in Supabase SQL Editor

-- Add audio_url column
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Add audio_duration_seconds column
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS audio_duration_seconds INTEGER;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'conversations' 
  AND column_name IN ('audio_url', 'audio_duration_seconds')
ORDER BY column_name;
