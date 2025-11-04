-- ============================================================================
-- Migration: Add audio recording fields to conversations table
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- This adds fields to store a single audio recording per conversation

-- Add audio_url column to conversations table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'audio_url'
  ) THEN
    ALTER TABLE conversations ADD COLUMN audio_url TEXT;
  END IF;
END $$;

-- Add audio_duration_seconds column to conversations table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'audio_duration_seconds'
  ) THEN
    ALTER TABLE conversations ADD COLUMN audio_duration_seconds INTEGER;
  END IF;
END $$;

-- Verify the migration
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'conversations' 
  AND column_name IN ('audio_url', 'audio_duration_seconds');

-- Expected result: 2 rows showing audio_url (text) and audio_duration_seconds (integer)
