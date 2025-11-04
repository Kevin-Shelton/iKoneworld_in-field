-- Fix null enterprise_id for existing user
-- Based on ACTUAL schema provided by user
-- enterprise_settings.enterprise_id is UUID (not VARCHAR)

DO $$
DECLARE
  v_enterprise_id UUID;
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
      '{}'::jsonb,
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_enterprise_id;
    
    RAISE NOTICE 'Created new enterprise with ID: %', v_enterprise_id;
  ELSE
    RAISE NOTICE 'Using existing enterprise with ID: %', v_enterprise_id;
  END IF;
  
  -- Step 2: Create enterprise_settings using the exact schema provided
  -- Columns from schema: id, enterprise_id (UUID), enable_audio_recording, enable_message_audio,
  -- enable_transcripts, save_transcripts_to_db, audio_access_roles, transcript_access_roles,
  -- audio_retention_days, transcript_retention_days, created_at, updated_at, created_by, updated_by
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
    updated_at,
    created_by,
    updated_by
  )
  VALUES (
    v_enterprise_id,
    true,
    false,
    true,
    true,
    ARRAY['enterprise_admin', 'regional_director', 'area_manager', 'district_manager', 'store_manager', 'field_sales', 'retail_staff']::text[],
    ARRAY['enterprise_admin', 'regional_director', 'area_manager', 'district_manager', 'store_manager', 'field_sales', 'retail_staff', 'viewer']::text[],
    90,
    90,
    NOW(),
    NOW(),
    NULL,
    NULL
  )
  ON CONFLICT (enterprise_id) DO UPDATE
  SET
    enable_audio_recording = EXCLUDED.enable_audio_recording,
    enable_transcripts = EXCLUDED.enable_transcripts,
    updated_at = NOW();
  
  RAISE NOTICE 'Created/updated enterprise_settings for enterprise_id: %', v_enterprise_id;
  
  -- Step 3: Update the user with the enterprise_id
  UPDATE users
  SET enterprise_id = v_enterprise_id
  WHERE email = 'kevin.shelton@egisdynamics.com';
  
  RAISE NOTICE 'Updated user with enterprise_id: %', v_enterprise_id;
END $$;

-- Verify the results
SELECT id, name, slug, subscription_tier, billing_status
FROM enterprises
WHERE slug = 'egisdynamics';

SELECT id, email, role, enterprise_id
FROM users
WHERE email = 'kevin.shelton@egisdynamics.com';

SELECT id, enterprise_id, enable_audio_recording, enable_transcripts, save_transcripts_to_db
FROM enterprise_settings
WHERE enterprise_id IN (SELECT id FROM enterprises WHERE slug = 'egisdynamics');
