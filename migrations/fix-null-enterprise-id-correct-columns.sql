-- Fix null enterprise_id for existing user
-- This script creates an enterprise record first, then updates the user
-- Uses correct column names from enterprise_settings table

-- Step 1: Create an enterprise record for EGIS Dynamics
DO $$
DECLARE
  v_enterprise_id UUID;
  v_enterprise_id_str VARCHAR(255);
BEGIN
  -- Check if an enterprise already exists
  SELECT id INTO v_enterprise_id
  FROM enterprises
  WHERE slug = 'egisdynamics'
  LIMIT 1;
  
  -- If no enterprise exists, create one
  IF v_enterprise_id IS NULL THEN
    INSERT INTO enterprises (
      id,
      name,
      slug,
      industry,
      subscription_tier,
      billing_email,
      billing_status,
      max_users,
      max_conversations_per_month,
      settings,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      'EGIS Dynamics',
      'egisdynamics',
      'Technology',
      'enterprise',
      'kevin.shelton@egisdynamics.com',
      'active',
      100,
      10000,
      '{"enable_audio_recording": true, "enable_transcripts": true}'::jsonb,
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_enterprise_id;
    
    RAISE NOTICE 'Created new enterprise with ID: %', v_enterprise_id;
  ELSE
    RAISE NOTICE 'Using existing enterprise with ID: %', v_enterprise_id;
  END IF;
  
  -- Convert UUID to string for enterprise_settings (which uses VARCHAR)
  v_enterprise_id_str := v_enterprise_id::VARCHAR(255);
  
  -- Step 2: Create or update enterprise_settings
  -- Note: enterprise_settings.enterprise_id is VARCHAR, not UUID
  INSERT INTO enterprise_settings (
    enterprise_id,
    enable_audio_recording,
    enable_message_audio,
    enable_transcripts,
    save_transcripts_to_db,
    audio_access_roles,
    transcript_access_roles,
    audio_retention_days,
    transcript_retention_days,
    created_at,
    updated_at
  )
  VALUES (
    v_enterprise_id_str,
    true,
    false,
    true,
    true,
    ARRAY['enterprise_admin', 'regional_director', 'area_manager', 'district_manager', 'store_manager'],
    ARRAY['enterprise_admin', 'regional_director', 'area_manager', 'district_manager', 'store_manager'],
    90,
    90,
    NOW(),
    NOW()
  )
  ON CONFLICT (enterprise_id) DO UPDATE
  SET
    enable_audio_recording = EXCLUDED.enable_audio_recording,
    enable_transcripts = EXCLUDED.enable_transcripts,
    updated_at = NOW();
  
  RAISE NOTICE 'Created/updated enterprise_settings for enterprise_id: %', v_enterprise_id_str;
  
  -- Step 3: Update the user with the enterprise_id
  UPDATE users
  SET enterprise_id = v_enterprise_id
  WHERE email = 'kevin.shelton@egisdynamics.com'
    AND enterprise_id IS NULL;
  
  RAISE NOTICE 'Updated user with enterprise_id: %', v_enterprise_id;
END $$;

-- Verify the results
SELECT id, name, slug, subscription_tier, billing_status
FROM enterprises
WHERE slug = 'egisdynamics';

SELECT id, email, role, enterprise_id
FROM users
WHERE email = 'kevin.shelton@egisdynamics.com';

SELECT enterprise_id, enable_audio_recording, enable_transcripts, save_transcripts_to_db
FROM enterprise_settings
WHERE enterprise_id IN (SELECT id::VARCHAR FROM enterprises WHERE slug = 'egisdynamics');
