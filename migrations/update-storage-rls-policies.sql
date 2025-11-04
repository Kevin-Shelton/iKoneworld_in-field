-- Migration: Update Supabase Storage RLS policies for persistent audio access
-- Purpose: Replace time-limited signed URLs with proper RLS-based access control
-- Date: 2024-11-04
-- NOTE: Run this in Supabase SQL Editor, not via application

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated uploads to audio-recordings" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read their enterprise audio" ON storage.objects;
DROP POLICY IF EXISTS "Allow service role full access to audio-recordings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their enterprise audio" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access" ON storage.objects;

-- Ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow authenticated users to upload audio files to their enterprise folder
CREATE POLICY "Authenticated users can upload audio to their enterprise"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio-recordings' AND
  -- Check that the first folder in the path matches user's enterprise_id
  (storage.foldername(name))[1] IN (
    SELECT enterprise_id::text FROM users WHERE "openId" = auth.uid()::text
  )
);

-- Policy 2: Allow authenticated users to read audio from their own enterprise
-- This enables persistent audio access without time limits
CREATE POLICY "Authenticated users can read their enterprise audio"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'audio-recordings' AND
  -- Check that the first folder in the path matches user's enterprise_id
  (storage.foldername(name))[1] IN (
    SELECT enterprise_id::text FROM users WHERE "openId" = auth.uid()::text
  )
);

-- Policy 3: Allow authenticated users to update audio metadata in their enterprise
CREATE POLICY "Authenticated users can update their enterprise audio"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'audio-recordings' AND
  (storage.foldername(name))[1] IN (
    SELECT enterprise_id::text FROM users WHERE "openId" = auth.uid()::text
  )
)
WITH CHECK (
  bucket_id = 'audio-recordings' AND
  (storage.foldername(name))[1] IN (
    SELECT enterprise_id::text FROM users WHERE "openId" = auth.uid()::text
  )
);

-- Policy 4: Allow admins to delete audio files in their enterprise
CREATE POLICY "Admins can delete their enterprise audio"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'audio-recordings' AND
  (storage.foldername(name))[1] IN (
    SELECT enterprise_id::text FROM users 
    WHERE "openId" = auth.uid()::text AND role = 'enterprise_admin'::user_role
  )
);

-- Policy 5: Service role has full access (for backend operations)
CREATE POLICY "Service role full access to audio-recordings"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'audio-recordings')
WITH CHECK (bucket_id = 'audio-recordings');

-- Verify policies are created
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
  AND schemaname = 'storage'
  AND policyname LIKE '%audio%'
ORDER BY policyname;
