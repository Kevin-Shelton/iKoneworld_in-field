import { pgTable, serial, varchar, text, timestamp, boolean, integer, pgEnum } from "drizzle-orm/pg-core";

// Define PostgreSQL enums
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const textDirectionEnum = pgEnum("text_direction", ["ltr", "rtl"]);
export const voiceGenderEnum = pgEnum("voice_gender", ["male", "female", "neutral"]);
export const conversationStatusEnum = pgEnum("conversation_status", ["active", "completed", "failed"]);
export const messageSpeakerEnum = pgEnum("message_speaker", ["user", "guest"]);

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Core languages table - stores base language metadata
 * Used for language selection and display
 */
export const languages = pgTable("languages", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(), // e.g., "en-US", "es-MX"
  baseCode: varchar("baseCode", { length: 8 }).notNull(), // e.g., "en", "es"
  name: varchar("name", { length: 255 }).notNull(), // e.g., "English (United States)"
  nativeName: varchar("nativeName", { length: 255 }), // e.g., "English"
  direction: textDirectionEnum("direction").default("ltr").notNull(),
  countryCode: varchar("countryCode", { length: 8 }), // e.g., "US", "MX"
  isFavorite: boolean("isFavorite").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Language = typeof languages.$inferSelect;
export type InsertLanguage = typeof languages.$inferInsert;

/**
 * STT (Speech-to-Text) language support table
 * Stores language variants supported by the STT service
 */
export const sttLanguages = pgTable("stt_languages", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(), // Full language code (e.g., "en-US")
  lang: varchar("lang", { length: 8 }).notNull(), // Base language (e.g., "en")
  origin: varchar("origin", { length: 255 }), // Origin/country (e.g., "United States")
  displayLang: varchar("displayLang", { length: 255 }), // Display language name
  displayOrigin: varchar("displayOrigin", { length: 255 }), // Display origin name
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SttLanguage = typeof sttLanguages.$inferSelect;
export type InsertSttLanguage = typeof sttLanguages.$inferInsert;

/**
 * TTS (Text-to-Speech) voices table
 * Stores available voices for each language
 */
export const ttsVoices = pgTable("tts_voices", {
  id: serial("id").primaryKey(),
  language: varchar("language", { length: 16 }).notNull(), // Language code (e.g., "en-US")
  voice: varchar("voice", { length: 255 }).notNull(), // Voice identifier (e.g., "en-US-JennyNeural") - not unique as voices can be reused across languages
  gender: voiceGenderEnum("gender").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TtsVoice = typeof ttsVoices.$inferSelect;
export type InsertTtsVoice = typeof ttsVoices.$inferInsert;

/**
 * TTT (Text-to-Text) translation language support table
 * Stores languages supported by the translation service
 */
export const tttLanguages = pgTable("ttt_languages", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(), // Language code (e.g., "en", "es")
  name: varchar("name", { length: 255 }).notNull(), // Language name
  nativeName: varchar("nativeName", { length: 255 }), // Native language name
  direction: textDirectionEnum("direction").default("ltr").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TttLanguage = typeof tttLanguages.$inferSelect;
export type InsertTttLanguage = typeof tttLanguages.$inferInsert;

/**
 * Conversations table - stores conversation sessions
 */
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(), // Foreign key to users table
  language1: varchar("language1", { length: 16 }).notNull(), // Primary language (e.g., "en-US")
  language2: varchar("language2", { length: 16 }).notNull(), // Secondary language (e.g., "es-MX")
  status: conversationStatusEnum("status").default("active").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Conversation messages table - stores individual messages within conversations
 */
export const conversationMessages = pgTable("conversation_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversationId").notNull(), // Foreign key to conversations table
  speaker: messageSpeakerEnum("speaker").notNull(), // Who spoke (user or guest)
  originalText: text("originalText").notNull(), // Original recognized text
  translatedText: text("translatedText").notNull(), // Translated text
  language: varchar("language", { length: 16 }).notNull(), // Language of original text
  confidence: integer("confidence").notNull(), // Confidence score (0-100, stored as integer percentage)
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertConversationMessage = typeof conversationMessages.$inferInsert;
