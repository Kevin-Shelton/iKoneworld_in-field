-- Add new columns to email_messages table for enhanced functionality

-- Add is_read column (default false for new messages)
ALTER TABLE email_messages 
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- Add is_deleted column (soft delete)
ALTER TABLE email_messages
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Add is_archived column
ALTER TABLE email_messages
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Add deleted_at timestamp
ALTER TABLE email_messages
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add folder column (inbox, sent, drafts, trash, archive)
ALTER TABLE email_threads
ADD COLUMN IF NOT EXISTS folder VARCHAR(50) DEFAULT 'inbox';

-- Add is_deleted to threads as well
ALTER TABLE email_threads
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Add deleted_at to threads
ALTER TABLE email_threads
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create drafts table for saving draft emails
CREATE TABLE IF NOT EXISTS email_drafts (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(320) NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  recipients JSONB, -- Array of {email, name, language}
  sender_language VARCHAR(16) DEFAULT 'en',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_messages_is_read ON email_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_email_messages_is_deleted ON email_messages(is_deleted);
CREATE INDEX IF NOT EXISTS idx_email_messages_is_archived ON email_messages(is_archived);
CREATE INDEX IF NOT EXISTS idx_email_threads_folder ON email_threads(folder);
CREATE INDEX IF NOT EXISTS idx_email_threads_is_deleted ON email_threads(is_deleted);
CREATE INDEX IF NOT EXISTS idx_email_drafts_user_email ON email_drafts(user_email);

-- Add comment for documentation
COMMENT ON COLUMN email_messages.is_read IS 'Whether the message has been read by the user';
COMMENT ON COLUMN email_messages.is_deleted IS 'Soft delete flag - message moved to trash';
COMMENT ON COLUMN email_messages.is_archived IS 'Message archived for organization';
COMMENT ON TABLE email_drafts IS 'Stores draft emails that are being composed';
