-- Migration: Add user_favorite_languages table
-- Created: 2024-11-03
-- Description: Stores user-specific favorite languages

CREATE TABLE IF NOT EXISTS "user_favorite_languages" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "languageCode" varchar(16) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS "user_favorite_languages_userId_idx" ON "user_favorite_languages" ("userId");
CREATE INDEX IF NOT EXISTS "user_favorite_languages_languageCode_idx" ON "user_favorite_languages" ("languageCode");

-- Add unique constraint to prevent duplicate favorites
CREATE UNIQUE INDEX IF NOT EXISTS "user_favorite_languages_userId_languageCode_unique" ON "user_favorite_languages" ("userId", "languageCode");
