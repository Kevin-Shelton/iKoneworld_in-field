-- Migration: Create enterprise_settings table
-- Purpose: Enable admin-level controls for audio recordings and transcripts
-- Date: 2024-11-04

-- Create enterprise_settings table
CREATE TABLE IF NOT EXISTS enterprise_settings (
  id SERIAL PRIMARY KEY,
  enterprise_id VARCHAR(255) UNIQUE NOT NULL,
  
  -- Recording controls
  enable_audio_recording BOOLEAN DEFAULT true NOT NULL,
  enable_message_audio BOOLEAN DEFAULT false NOT NULL,
  
  -- Transcript controls
  enable_transcripts BOOLEAN DEFAULT true NOT NULL,
  save_transcripts_to_db BOOLEAN DEFAULT true NOT NULL,
  
  -- Audio access controls (array of role names)
  audio_access_roles TEXT[] DEFAULT ARRAY['admin', 'manager', 'employee'] NOT NULL,
  transcript_access_roles TEXT[] DEFAULT ARRAY['admin', 'manager', 'employee'] NOT NULL,
  
  -- Retention policies (NULL = keep forever)
  audio_retention_days INTEGER DEFAULT NULL,
  transcript_retention_days INTEGER DEFAULT NULL,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Create index for fast enterprise lookups
CREATE INDEX IF NOT EXISTS idx_enterprise_settings_enterprise_id 
  ON enterprise_settings(enterprise_id);

-- Add comment to table
COMMENT ON TABLE enterprise_settings IS 'Enterprise-level settings for audio recording and transcript controls';

-- Add comments to columns
COMMENT ON COLUMN enterprise_settings.enable_audio_recording IS 'Master switch for audio recording feature';
COMMENT ON COLUMN enterprise_settings.enable_message_audio IS 'Enable per-message audio recording (future feature)';
COMMENT ON COLUMN enterprise_settings.enable_transcripts IS 'Master switch for transcript feature';
COMMENT ON COLUMN enterprise_settings.save_transcripts_to_db IS 'Whether to save transcripts to database';
COMMENT ON COLUMN enterprise_settings.audio_access_roles IS 'Array of role names that can access audio recordings';
COMMENT ON COLUMN enterprise_settings.transcript_access_roles IS 'Array of role names that can access transcripts';
COMMENT ON COLUMN enterprise_settings.audio_retention_days IS 'Number of days to keep audio files (NULL = forever)';
COMMENT ON COLUMN enterprise_settings.transcript_retention_days IS 'Number of days to keep transcripts (NULL = forever)';

-- Insert default settings for the default enterprise
-- This ensures existing installations have settings
INSERT INTO enterprise_settings (
  enterprise_id,
  enable_audio_recording,
  enable_message_audio,
  enable_transcripts,
  save_transcripts_to_db,
  audio_access_roles,
  transcript_access_roles
) VALUES (
  '00000000-0000-00',  -- Default enterprise ID
  true,
  false,
  true,
  true,
  ARRAY['admin', 'manager', 'employee'],
  ARRAY['admin', 'manager', 'employee']
) ON CONFLICT (enterprise_id) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE enterprise_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own enterprise settings
CREATE POLICY "Users can read their enterprise settings"
ON enterprise_settings
FOR SELECT
TO authenticated
USING (
  enterprise_id IN (
    SELECT enterprise_id FROM users WHERE auth_id = auth.uid()
  )
);

-- RLS Policy: Only admins can update enterprise settings
CREATE POLICY "Admins can update enterprise settings"
ON enterprise_settings
FOR UPDATE
TO authenticated
USING (
  enterprise_id IN (
    SELECT enterprise_id FROM users WHERE auth_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  enterprise_id IN (
    SELECT enterprise_id FROM users WHERE auth_id = auth.uid() AND role = 'admin'
  )
);

-- RLS Policy: Service role has full access
CREATE POLICY "Service role full access to enterprise settings"
ON enterprise_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
