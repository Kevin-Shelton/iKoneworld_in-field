-- Step 1: Create enterprise_settings table only (no RLS)
-- This will help us isolate where the error is occurring

-- Create enterprise_settings table
CREATE TABLE IF NOT EXISTS enterprise_settings (
  id SERIAL PRIMARY KEY,
  enterprise_id UUID UNIQUE NOT NULL,
  
  -- Recording controls
  enable_audio_recording BOOLEAN DEFAULT true NOT NULL,
  enable_message_audio BOOLEAN DEFAULT false NOT NULL,
  
  -- Transcript controls
  enable_transcripts BOOLEAN DEFAULT true NOT NULL,
  save_transcripts_to_db BOOLEAN DEFAULT true NOT NULL,
  
  -- Audio access controls (array of role names)
  audio_access_roles TEXT[] DEFAULT ARRAY[
    'enterprise_admin',
    'regional_director',
    'area_manager',
    'district_manager',
    'store_manager',
    'field_sales',
    'retail_staff'
  ] NOT NULL,
  
  -- Transcript access controls (array of role names)
  transcript_access_roles TEXT[] DEFAULT ARRAY[
    'enterprise_admin',
    'regional_director',
    'area_manager',
    'district_manager',
    'store_manager',
    'field_sales',
    'retail_staff',
    'viewer'
  ] NOT NULL,
  
  -- Retention policies (NULL = keep forever)
  audio_retention_days INTEGER DEFAULT NULL,
  transcript_retention_days INTEGER DEFAULT NULL,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_by INTEGER,
  updated_by INTEGER
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_enterprise_settings_enterprise_id 
  ON enterprise_settings(enterprise_id);

-- Insert default settings
INSERT INTO enterprise_settings (
  enterprise_id,
  enable_audio_recording,
  enable_message_audio,
  enable_transcripts,
  save_transcripts_to_db,
  audio_access_roles,
  transcript_access_roles
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  true,
  false,
  true,
  true,
  ARRAY[
    'enterprise_admin',
    'regional_director',
    'area_manager',
    'district_manager',
    'store_manager',
    'field_sales',
    'retail_staff'
  ],
  ARRAY[
    'enterprise_admin',
    'regional_director',
    'area_manager',
    'district_manager',
    'store_manager',
    'field_sales',
    'retail_staff',
    'viewer'
  ]
) ON CONFLICT (enterprise_id) DO UPDATE SET
  audio_access_roles = EXCLUDED.audio_access_roles,
  transcript_access_roles = EXCLUDED.transcript_access_roles,
  updated_at = NOW();

-- Verify
SELECT 'Table created successfully!' as status;
SELECT COUNT(*) as row_count FROM enterprise_settings;
