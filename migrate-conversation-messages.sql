-- ============================================================================
-- Migration: Update conversation_messages table to match code expectations
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- This script updates the conversation_messages table to support:
-- - Enterprise multi-tenancy
-- - Source and target languages (instead of single language field)
-- - Audio recordings
-- - Confidence scores
-- - Additional metadata

-- ============================================================================
-- STEP 1: Check current table structure
-- ============================================================================

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'conversation_messages'
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 2: Add new columns if they don't exist
-- ============================================================================

-- Add enterprise_id column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_messages' AND column_name = 'enterprise_id'
  ) THEN
    ALTER TABLE conversation_messages ADD COLUMN enterprise_id VARCHAR(255);
  END IF;
END $$;

-- Add user_id column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_messages' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE conversation_messages ADD COLUMN user_id INTEGER;
  END IF;
END $$;

-- Add source_language column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_messages' AND column_name = 'source_language'
  ) THEN
    ALTER TABLE conversation_messages ADD COLUMN source_language VARCHAR(16);
  END IF;
END $$;

-- Add target_language column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_messages' AND column_name = 'target_language'
  ) THEN
    ALTER TABLE conversation_messages ADD COLUMN target_language VARCHAR(16);
  END IF;
END $$;

-- Add audio_url column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_messages' AND column_name = 'audio_url'
  ) THEN
    ALTER TABLE conversation_messages ADD COLUMN audio_url TEXT;
  END IF;
END $$;

-- Add audio_duration_seconds column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_messages' AND column_name = 'audio_duration_seconds'
  ) THEN
    ALTER TABLE conversation_messages ADD COLUMN audio_duration_seconds INTEGER;
  END IF;
END $$;

-- Add confidence_score column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_messages' AND column_name = 'confidence_score'
  ) THEN
    ALTER TABLE conversation_messages ADD COLUMN confidence_score DECIMAL(3,2);
  END IF;
END $$;

-- Add metadata column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_messages' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE conversation_messages ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Rename columns if they use old naming convention
-- ============================================================================

-- Rename originalText to original_text (if needed)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_messages' AND column_name = 'originalText'
  ) THEN
    ALTER TABLE conversation_messages RENAME COLUMN "originalText" TO original_text;
  END IF;
END $$;

-- Rename translatedText to translated_text (if needed)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_messages' AND column_name = 'translatedText'
  ) THEN
    ALTER TABLE conversation_messages RENAME COLUMN "translatedText" TO translated_text;
  END IF;
END $$;

-- Rename conversationId to conversationId (if needed - keep camelCase for this one)
-- Note: We're keeping conversationId as-is since the code uses it

-- ============================================================================
-- STEP 4: Make old columns nullable (if they were required before)
-- ============================================================================

-- Make language column nullable (since we now use source_language and target_language)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_messages' AND column_name = 'language'
  ) THEN
    ALTER TABLE conversation_messages ALTER COLUMN language DROP NOT NULL;
  END IF;
END $$;

-- Make confidence column nullable (since we now use confidence_score)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_messages' AND column_name = 'confidence'
  ) THEN
    ALTER TABLE conversation_messages ALTER COLUMN confidence DROP NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Migrate existing data (if any)
-- ============================================================================

-- Copy language to source_language for existing records
UPDATE conversation_messages
SET source_language = language
WHERE source_language IS NULL AND language IS NOT NULL;

-- Copy confidence to confidence_score for existing records (convert INTEGER to DECIMAL)
UPDATE conversation_messages
SET confidence_score = confidence::DECIMAL / 100.0
WHERE confidence_score IS NULL AND confidence IS NOT NULL;

-- ============================================================================
-- STEP 6: Verify the migration
-- ============================================================================

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'conversation_messages'
ORDER BY ordinal_position;

-- Expected columns:
-- id, conversationId, enterprise_id, user_id, speaker, original_text, translated_text,
-- source_language, target_language, audio_url, audio_duration_seconds, confidence_score,
-- timestamp, createdAt, metadata

-- ============================================================================
-- STEP 7: Test with a sample query
-- ============================================================================

SELECT 
  id,
  "conversationId",
  speaker,
  original_text,
  translated_text,
  source_language,
  target_language,
  audio_url,
  confidence_score,
  timestamp
FROM conversation_messages
ORDER BY timestamp DESC
LIMIT 5;
