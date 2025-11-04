-- Add enterprise and organizational fields to conversations table
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS enterprise_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS store_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS department_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_id INTEGER,
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add enterprise and organizational fields to conversation_messages table
ALTER TABLE conversation_messages
ADD COLUMN IF NOT EXISTS enterprise_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS user_id INTEGER,
ADD COLUMN IF NOT EXISTS original_text TEXT,
ADD COLUMN IF NOT EXISTS translated_text TEXT,
ADD COLUMN IF NOT EXISTS source_language VARCHAR(16),
ADD COLUMN IF NOT EXISTS target_language VARCHAR(16),
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS audio_duration_seconds NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5, 2);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_enterprise_id ON conversations(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_conversations_store_id ON conversations(store_id);
CREATE INDEX IF NOT EXISTS idx_conversations_department_id ON conversations(department_id);
CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_metadata ON conversations USING gin(metadata);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_enterprise_id ON conversation_messages(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_user_id ON conversation_messages(user_id);

-- Add comment explaining metadata column usage
COMMENT ON COLUMN conversations.metadata IS 'JSONB column for flexible data storage. Used for demo chat flag: {"is_demo": true}';
