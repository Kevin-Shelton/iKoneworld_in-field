-- Fix null enterprise_id for existing user
-- This script sets a proper enterprise_id (UUID) for the user with email kevin.shelton@egisdynamics.com

-- First, let's check if there's an existing enterprise_settings record we can use
-- If not, we'll create one with a new UUID

-- Create or get the enterprise_settings record for egisdynamics
DO $$
DECLARE
  v_enterprise_id UUID;
BEGIN
  -- Try to find an existing enterprise_settings record
  SELECT enterprise_id INTO v_enterprise_id
  FROM enterprise_settings
  LIMIT 1;
  
  -- If no enterprise_settings exist, create one with a new UUID
  IF v_enterprise_id IS NULL THEN
    v_enterprise_id := gen_random_uuid();
    
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
      v_enterprise_id,
      true,
      true,
      90,
      90,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Created new enterprise_settings with ID: %', v_enterprise_id;
  ELSE
    RAISE NOTICE 'Using existing enterprise_settings with ID: %', v_enterprise_id;
  END IF;
  
  -- Update the user with the enterprise_id
  UPDATE users
  SET enterprise_id = v_enterprise_id
  WHERE email = 'kevin.shelton@egisdynamics.com'
    AND enterprise_id IS NULL;
  
  RAISE NOTICE 'Updated user with enterprise_id: %', v_enterprise_id;
END $$;

-- Verify the update
SELECT id, email, role, enterprise_id
FROM users
WHERE email = 'kevin.shelton@egisdynamics.com';

-- Verify the enterprise_settings record
SELECT enterprise_id, enable_audio_recording, enable_transcript_storage
FROM enterprise_settings;
