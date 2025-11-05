-- Email Viewer Demo Schema
-- Creates tables for email thread management, message storage, glossary, and send intents

-- ============================================================================
-- Email Threads Table
-- ============================================================================
-- Stores email conversation threads with participants and metadata
CREATE TABLE IF NOT EXISTS email_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    participants JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- participants structure: [{ email: string, name: string, language: string }]
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    is_demo BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for efficient thread listing and sorting
CREATE INDEX IF NOT EXISTS idx_email_threads_updated_at ON email_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message_at ON email_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_threads_is_demo ON email_threads(is_demo);

-- ============================================================================
-- Email Messages Table
-- ============================================================================
-- Stores individual email messages with original and translated content
CREATE TABLE IF NOT EXISTS email_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
    sender_email TEXT NOT NULL,
    sender_name TEXT,
    sender_language TEXT NOT NULL DEFAULT 'en',
    original_content TEXT NOT NULL,
    original_language TEXT NOT NULL,
    translations JSONB DEFAULT '{}'::jsonb,
    -- translations structure: { "en": "...", "es": "...", "fr": "..." }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_outbound BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for efficient message retrieval
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON email_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_email_messages_created_at ON email_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_sender_email ON email_messages(sender_email);

-- ============================================================================
-- Glossary Terms Table
-- ============================================================================
-- Stores custom translation terms for specialized vocabulary
CREATE TABLE IF NOT EXISTS glossary_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_term TEXT NOT NULL,
    source_language TEXT NOT NULL,
    target_term TEXT NOT NULL,
    target_language TEXT NOT NULL,
    context TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(source_term, source_language, target_language)
);

-- Indexes for glossary lookup
CREATE INDEX IF NOT EXISTS idx_glossary_terms_source ON glossary_terms(source_language, source_term) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_glossary_terms_target ON glossary_terms(target_language) WHERE is_active = true;

-- ============================================================================
-- Send Intents Table
-- ============================================================================
-- Stores outbound email queue with translation status
CREATE TABLE IF NOT EXISTS send_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
    sender_email TEXT NOT NULL,
    sender_name TEXT,
    sender_language TEXT NOT NULL,
    original_content TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    recipient_language TEXT NOT NULL,
    translated_content TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    -- status: pending, translating, translated, sent, failed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for send queue management
CREATE INDEX IF NOT EXISTS idx_send_intents_status ON send_intents(status, created_at);
CREATE INDEX IF NOT EXISTS idx_send_intents_thread_id ON send_intents(thread_id);

-- ============================================================================
-- Triggers for updated_at timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_threads_updated_at
    BEFORE UPDATE ON email_threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_glossary_terms_updated_at
    BEFORE UPDATE ON glossary_terms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE glossary_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE send_intents ENABLE ROW LEVEL SECURITY;

-- Email Threads Policies
-- Allow authenticated users to read demo threads
CREATE POLICY "Allow authenticated users to read demo threads"
    ON email_threads FOR SELECT
    TO authenticated
    USING (is_demo = true);

-- Allow authenticated users to create demo threads
CREATE POLICY "Allow authenticated users to create demo threads"
    ON email_threads FOR INSERT
    TO authenticated
    WITH CHECK (is_demo = true);

-- Allow authenticated users to update demo threads
CREATE POLICY "Allow authenticated users to update demo threads"
    ON email_threads FOR UPDATE
    TO authenticated
    USING (is_demo = true);

-- Email Messages Policies
-- Allow authenticated users to read messages from demo threads
CREATE POLICY "Allow authenticated users to read demo messages"
    ON email_messages FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM email_threads
            WHERE email_threads.id = email_messages.thread_id
            AND email_threads.is_demo = true
        )
    );

-- Allow authenticated users to create messages in demo threads
CREATE POLICY "Allow authenticated users to create demo messages"
    ON email_messages FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM email_threads
            WHERE email_threads.id = email_messages.thread_id
            AND email_threads.is_demo = true
        )
    );

-- Glossary Terms Policies
-- Allow all authenticated users to read active glossary terms
CREATE POLICY "Allow authenticated users to read glossary"
    ON glossary_terms FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Allow authenticated users to create glossary terms
CREATE POLICY "Allow authenticated users to create glossary"
    ON glossary_terms FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow users to update their own glossary terms
CREATE POLICY "Allow users to update own glossary"
    ON glossary_terms FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid());

-- Send Intents Policies
-- Allow authenticated users to read send intents from demo threads
CREATE POLICY "Allow authenticated users to read demo send intents"
    ON send_intents FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM email_threads
            WHERE email_threads.id = send_intents.thread_id
            AND email_threads.is_demo = true
        )
    );

-- Allow authenticated users to create send intents
CREATE POLICY "Allow authenticated users to create send intents"
    ON send_intents FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM email_threads
            WHERE email_threads.id = send_intents.thread_id
            AND email_threads.is_demo = true
        )
    );

-- Allow authenticated users to update send intents
CREATE POLICY "Allow authenticated users to update send intents"
    ON send_intents FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM email_threads
            WHERE email_threads.id = send_intents.thread_id
            AND email_threads.is_demo = true
        )
    );

-- ============================================================================
-- Sample Data for Demo
-- ============================================================================

-- Insert sample email thread
INSERT INTO email_threads (subject, participants, last_message_at, metadata)
VALUES (
    'Welcome to iKoneworld Translation Demo',
    '[
        {"email": "demo-employee@ikoneworld.com", "name": "Demo Employee", "language": "en"},
        {"email": "demo-customer@example.com", "name": "Demo Customer", "language": "es"}
    ]'::jsonb,
    NOW(),
    '{"demo_type": "welcome", "auto_created": true}'::jsonb
) ON CONFLICT DO NOTHING;

-- Insert sample welcome message (will be populated by app initialization)

COMMENT ON TABLE email_threads IS 'Email conversation threads with participants and metadata';
COMMENT ON TABLE email_messages IS 'Individual email messages with original and translated content';
COMMENT ON TABLE glossary_terms IS 'Custom translation terms for specialized vocabulary';
COMMENT ON TABLE send_intents IS 'Outbound email queue with translation status';
