import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import {
  users,
  languages,
  sttLanguages,
  ttsVoices,
  tttLanguages,
  conversations,
  conversationMessages,
  type Language,
  type SttLanguage,
  type TtsVoice,
  type TttLanguage,
  type Conversation,
  type ConversationMessage,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL);
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Language data queries
export async function getAllLanguages(): Promise<Language[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(languages);
}

export async function getFavoriteLanguages(): Promise<Language[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(languages).where(eq(languages.isFavorite, true));
}

export async function getAllSttLanguages(): Promise<SttLanguage[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(sttLanguages);
}

export async function getAllTtsVoices(): Promise<TtsVoice[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(ttsVoices);
}

export async function getTtsVoicesByLanguage(languageCode: string): Promise<TtsVoice[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(ttsVoices).where(eq(ttsVoices.language, languageCode));
}

export async function getAllTttLanguages(): Promise<TttLanguage[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tttLanguages);
}
