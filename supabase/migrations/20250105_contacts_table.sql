-- Migration: Create contacts table for email-to-language associations
-- Run this in Supabase SQL Editor

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL UNIQUE,
  name VARCHAR(255),
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  company VARCHAR(255),
  phone VARCHAR(50),
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- Create index on language for filtering
CREATE INDEX IF NOT EXISTS idx_contacts_language ON contacts(language);

-- Enable Row Level Security
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read all contacts
CREATE POLICY "Allow authenticated users to read contacts"
  ON contacts
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow authenticated users to insert contacts
CREATE POLICY "Allow authenticated users to insert contacts"
  ON contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Allow authenticated users to update contacts
CREATE POLICY "Allow authenticated users to update contacts"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to delete contacts
CREATE POLICY "Allow authenticated users to delete contacts"
  ON contacts
  FOR DELETE
  TO authenticated
  USING (true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function on update
DROP TRIGGER IF EXISTS trigger_update_contacts_updated_at ON contacts;
CREATE TRIGGER trigger_update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

-- Seed some demo contacts from existing email messages
-- This will auto-populate contacts based on the email demo data
INSERT INTO contacts (email, name, language, last_contacted_at, notes)
VALUES
  ('cliente@ejemplo.es', 'Carlos García', 'es', NOW() - INTERVAL '2 hours', 'Product inquiry - Spanish customer'),
  ('partenaire@exemple.fr', 'Jean Dupont', 'fr', NOW() - INTERVAL '2 hours', 'Partnership opportunity - French contact'),
  ('contact@example.jp', 'Tanaka Yuki', 'ja', NOW() - INTERVAL '2 hours', 'Technical documentation request - Japanese customer'),
  ('employee@ikoneworld.com', 'Sarah Johnson', 'en', NOW(), 'iKoneworld employee - English')
ON CONFLICT (email) DO UPDATE
  SET 
    name = EXCLUDED.name,
    language = EXCLUDED.language,
    last_contacted_at = EXCLUDED.last_contacted_at,
    notes = EXCLUDED.notes;

-- Add comment to table
COMMENT ON TABLE contacts IS 'Stores contact information with language preferences for smart email translation';
COMMENT ON COLUMN contacts.email IS 'Unique email address for the contact';
COMMENT ON COLUMN contacts.language IS 'ISO 639-1 language code (en, es, fr, ja, etc.)';
COMMENT ON COLUMN contacts.last_contacted_at IS 'Timestamp of last email sent or received from this contact';
