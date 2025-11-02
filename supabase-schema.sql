-- iK OneWorld Database Schema for PostgreSQL (Supabase)
-- Run this script in your Supabase SQL Editor

-- Create ENUM types first
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE message_speaker AS ENUM ('user', 'guest');
CREATE TYPE conversation_status AS ENUM ('active', 'completed', 'failed');
CREATE TYPE text_direction AS ENUM ('ltr', 'rtl');
CREATE TYPE voice_gender AS ENUM ('male', 'female', 'neutral');

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    "openId" VARCHAR(64) NOT NULL UNIQUE,
    name TEXT,
    email VARCHAR(320),
    "loginMethod" VARCHAR(64),
    role user_role NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "lastSignedIn" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Languages table (main language metadata)
CREATE TABLE languages (
    id SERIAL PRIMARY KEY,
    code VARCHAR(16) NOT NULL UNIQUE,
    "baseCode" VARCHAR(8) NOT NULL,
    name VARCHAR(255) NOT NULL,
    "nativeName" VARCHAR(255),
    direction text_direction NOT NULL DEFAULT 'ltr',
    "countryCode" VARCHAR(8),
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- STT Languages table (Speech-to-Text supported languages)
CREATE TABLE stt_languages (
    id SERIAL PRIMARY KEY,
    code VARCHAR(16) NOT NULL UNIQUE,
    lang VARCHAR(8) NOT NULL,
    origin VARCHAR(255),
    "displayLang" VARCHAR(255),
    "displayOrigin" VARCHAR(255),
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- TTS Voices table (Text-to-Speech voices)
CREATE TABLE tts_voices (
    id SERIAL PRIMARY KEY,
    language VARCHAR(16) NOT NULL,
    voice VARCHAR(255) NOT NULL,
    gender voice_gender NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- TTT Languages table (Text-to-Text translation supported languages)
CREATE TABLE ttt_languages (
    id SERIAL PRIMARY KEY,
    code VARCHAR(16) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    "nativeName" VARCHAR(255),
    direction text_direction NOT NULL DEFAULT 'ltr',
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Conversations table
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    language1 VARCHAR(16) NOT NULL,
    language2 VARCHAR(16) NOT NULL,
    status conversation_status NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "endedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Conversation Messages table
CREATE TABLE conversation_messages (
    id SERIAL PRIMARY KEY,
    "conversationId" INTEGER NOT NULL,
    speaker message_speaker NOT NULL,
    "originalText" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    language VARCHAR(16) NOT NULL,
    confidence INTEGER NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_users_openid ON users("openId");
CREATE INDEX idx_languages_code ON languages(code);
CREATE INDEX idx_languages_favorite ON languages("isFavorite");
CREATE INDEX idx_stt_languages_code ON stt_languages(code);
CREATE INDEX idx_tts_voices_language ON tts_voices(language);
CREATE INDEX idx_ttt_languages_code ON ttt_languages(code);
CREATE INDEX idx_conversations_userid ON conversations("userId");
CREATE INDEX idx_conversation_messages_convid ON conversation_messages("conversationId");

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to conversations table
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database schema created successfully!';
    RAISE NOTICE 'Next step: Run the data migration script to populate language data.';
END $$;
