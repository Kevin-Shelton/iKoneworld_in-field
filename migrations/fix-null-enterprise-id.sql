-- Fix null enterprise_id for existing user
-- This script sets a proper enterprise_id for the user with email kevin.shelton@egisdynamics.com

-- Update the user with a proper enterprise_id
-- Using the domain from the email as the enterprise_id
UPDATE users
SET enterprise_id = 'egisdynamics'
WHERE email = 'kevin.shelton@egisdynamics.com'
  AND enterprise_id IS NULL;

-- Verify the update
SELECT id, email, role, enterprise_id
FROM users
WHERE email = 'kevin.shelton@egisdynamics.com';

-- Also create an enterprise_settings record if it doesn't exist
INSERT INTO enterprise_settings (
  enterprise_id,
  enable_audio_recording,
  enable_transcript_storage,
  audio_retention_days,
  transcript_retention_days,
  created_at,
  updated_at
)
VALUES (
  'egisdynamics',
  true,
  true,
  90,
  90,
  NOW(),
  NOW()
)
ON CONFLICT (enterprise_id) DO NOTHING;

-- Verify the enterprise_settings record
SELECT * FROM enterprise_settings WHERE enterprise_id = 'egisdynamics';
