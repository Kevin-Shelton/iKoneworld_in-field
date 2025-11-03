-- ============================================================================
-- Supabase Storage Setup for Audio Recordings
-- Run this script in your Supabase SQL Editor
-- ============================================================================

-- Note: Storage buckets must be created through the Supabase Dashboard UI first
-- This script only sets up the RLS policies

-- ============================================================================
-- STEP 1: Enable Row Level Security on storage.objects
-- ============================================================================

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Drop existing policies if they exist (for re-running the script)
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated uploads to audio-recordings" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read their enterprise audio" ON storage.objects;
DROP POLICY IF EXISTS "Allow service role full access to audio-recordings" ON storage.objects;

-- ============================================================================
-- STEP 3: Create storage policies for audio-recordings bucket
-- ============================================================================

-- Policy: Allow authenticated users to upload audio files
CREATE POLICY "Allow authenticated uploads to audio-recordings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio-recordings'
);

-- Policy: Allow authenticated users to read audio files
-- (You may want to restrict this further based on enterprise_id in the file path)
CREATE POLICY "Allow users to read their enterprise audio"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'audio-recordings'
);

-- Policy: Allow service role (backend) full access
-- This is used by the server-side API to upload/manage files
CREATE POLICY "Allow service role full access to audio-recordings"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'audio-recordings')
WITH CHECK (bucket_id = 'audio-recordings');

-- ============================================================================
-- STEP 4: Verify the policies were created
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND policyname LIKE '%audio-recordings%';

-- ============================================================================
-- MANUAL STEPS (Must be done in Supabase Dashboard)
-- ============================================================================

-- 1. Go to Storage in your Supabase Dashboard
-- 2. Click "Create a new bucket"
-- 3. Enter these settings:
--    - Name: audio-recordings
--    - Public: No (keep it private)
--    - File size limit: 50 MB
--    - Allowed MIME types: audio/webm, audio/wav, audio/mp3, audio/mpeg
-- 4. Click "Create bucket"

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check if the bucket exists (run after creating it in the dashboard)
SELECT * FROM storage.buckets WHERE name = 'audio-recordings';

-- Expected output:
-- id | name              | owner | created_at           | updated_at           | public | avif_autodetection | file_size_limit | allowed_mime_types
-- ---|-------------------|-------|---------------------|---------------------|--------|-------------------|-----------------|-------------------
-- ... | audio-recordings  | NULL  | 2024-XX-XX XX:XX:XX | 2024-XX-XX XX:XX:XX | false  | false             | 52428800        | {audio/webm,...}
