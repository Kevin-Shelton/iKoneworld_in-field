-- Migration: Auto-create/update contacts from email messages
-- Run this in Supabase SQL Editor after the contacts table migration

-- Function to auto-create or update contact when email message is inserted
CREATE OR REPLACE FUNCTION auto_create_contact_from_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update contact based on sender information
  INSERT INTO contacts (
    email,
    name,
    language,
    last_contacted_at,
    notes
  )
  VALUES (
    NEW.sender_email,
    NEW.sender_name,
    NEW.sender_language,
    NEW.created_at,
    CASE 
      WHEN NEW.is_outbound THEN 'Auto-created from sent email'
      ELSE 'Auto-created from received email'
    END
  )
  ON CONFLICT (email) 
  DO UPDATE SET
    -- Update name if the new one is more complete (longer)
    name = CASE 
      WHEN LENGTH(EXCLUDED.name) > LENGTH(contacts.name) THEN EXCLUDED.name
      ELSE contacts.name
    END,
    -- Update language (always use the most recent)
    language = EXCLUDED.language,
    -- Update last contacted time
    last_contacted_at = EXCLUDED.last_contacted_at,
    -- Update timestamp
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on email_messages table
DROP TRIGGER IF EXISTS trigger_auto_create_contact ON email_messages;
CREATE TRIGGER trigger_auto_create_contact
  AFTER INSERT ON email_messages
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_contact_from_message();

-- Add comment
COMMENT ON FUNCTION auto_create_contact_from_message() IS 'Automatically creates or updates contacts table when email messages are sent or received';

-- Backfill existing contacts from email_messages table
-- This will create contacts for all existing email senders
INSERT INTO contacts (email, name, language, last_contacted_at, notes)
SELECT DISTINCT ON (sender_email)
  sender_email,
  sender_name,
  sender_language,
  created_at as last_contacted_at,
  CASE 
    WHEN is_outbound THEN 'Auto-created from sent email'
    ELSE 'Auto-created from received email'
  END as notes
FROM email_messages
ORDER BY sender_email, created_at DESC
ON CONFLICT (email) 
DO UPDATE SET
  name = CASE 
    WHEN LENGTH(EXCLUDED.name) > LENGTH(contacts.name) THEN EXCLUDED.name
    ELSE contacts.name
  END,
  language = EXCLUDED.language,
  last_contacted_at = GREATEST(contacts.last_contacted_at, EXCLUDED.last_contacted_at);

-- Verify the trigger works
-- You can test by inserting a new email_message and checking if contact is created automatically
