# Supabase Storage Setup for Audio Recordings

## Overview
The iK OneWorld application stores audio recordings from translation sessions in Supabase Storage. This guide explains how to set up the required storage bucket.

## Storage Bucket Configuration

### 1. Create the Storage Bucket

In your Supabase dashboard:

1. Navigate to **Storage** in the left sidebar
2. Click **Create a new bucket**
3. Configure the bucket with these settings:

```
Bucket Name: audio-recordings
Public bucket: No (private)
File size limit: 50 MB
Allowed MIME types: audio/webm, audio/wav, audio/mp3, audio/mpeg
```

### 2. Set Up Storage Policies

The bucket needs Row Level Security (RLS) policies to control access. Run these SQL commands in the Supabase SQL Editor:

```sql
-- Enable RLS on the storage.objects table for the audio-recordings bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to upload audio files
CREATE POLICY "Allow authenticated uploads to audio-recordings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio-recordings'
);

-- Policy: Allow users to read their own enterprise's audio files
CREATE POLICY "Allow users to read their enterprise audio"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'audio-recordings'
);

-- Policy: Allow service role (backend) full access
CREATE POLICY "Allow service role full access to audio-recordings"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'audio-recordings')
WITH CHECK (bucket_id = 'audio-recordings');
```

### 3. Folder Structure

Audio files are organized by enterprise and conversation:

```
audio-recordings/
├── {enterprise_id}/
│   ├── {conversation_id}/
│   │   ├── user_{timestamp}.webm
│   │   ├── guest_{timestamp}.webm
│   │   └── ...
```

### 4. Verify Configuration

After setup, verify the bucket is working:

1. Check that the bucket appears in Storage dashboard
2. Verify RLS policies are active
3. Test by starting a translation session and checking if audio files are uploaded

## File Naming Convention

Audio files follow this pattern:
- **User recordings**: `user_{timestamp}.webm`
- **Guest recordings**: `guest_{timestamp}.webm`

Where `{timestamp}` is a Unix timestamp in milliseconds.

## Storage Limits

- **File size**: Maximum 50 MB per file
- **Retention**: Files are kept indefinitely (consider implementing cleanup policies)
- **Format**: Primary format is WebM (audio/webm)

## Troubleshooting

### Issue: "Bucket not found" error
**Solution**: Ensure the bucket name is exactly `audio-recordings` (case-sensitive)

### Issue: "Permission denied" error
**Solution**: Check that RLS policies are properly configured and the user is authenticated

### Issue: Files not uploading
**Solution**: 
1. Verify SUPABASE_SERVICE_ROLE_KEY is set in environment variables
2. Check that the bucket exists and is not public
3. Review Supabase logs for detailed error messages

## Environment Variables

Ensure these are set in your `.env.local` and Vercel environment:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Security Considerations

- Audio files contain sensitive conversation data
- The bucket is **private** (not publicly accessible)
- Access is controlled through RLS policies
- Service role key should never be exposed to the client
- Consider implementing automatic file deletion after a retention period

## Future Enhancements

Consider implementing:
1. Automatic file cleanup after 90 days
2. Audio transcription storage
3. File compression to reduce storage costs
4. CDN integration for faster audio playback
