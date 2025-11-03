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
  userFavoriteLanguages,
  type Language,
  type SttLanguage,
  type TtsVoice,
  type TttLanguage,
  type Conversation,
  type ConversationMessage,
  type UserFavoriteLanguage,
  type InsertUserFavoriteLanguage,
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

// User favorite languages queries
export async function getUserFavoriteLanguages(userId: number): Promise<Language[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Get user's favorite language codes
  const favorites = await db
    .select()
    .from(userFavoriteLanguages)
    .where(eq(userFavoriteLanguages.userId, userId));
  
  if (favorites.length === 0) return [];
  
  // Get full language details for favorites
  const favoriteCodes = favorites.map(f => f.languageCode);
  const allLangs = await db.select().from(languages);
  
  return allLangs.filter(lang => favoriteCodes.includes(lang.code));
}

export async function addUserFavoriteLanguage(userId: number, languageCode: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Check if already exists
  const existing = await db
    .select()
    .from(userFavoriteLanguages)
    .where(eq(userFavoriteLanguages.userId, userId))
    .where(eq(userFavoriteLanguages.languageCode, languageCode));
  
  if (existing.length === 0) {
    await db.insert(userFavoriteLanguages).values({ userId, languageCode });
  }
}

export async function removeUserFavoriteLanguage(userId: number, languageCode: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .delete(userFavoriteLanguages)
    .where(eq(userFavoriteLanguages.userId, userId))
    .where(eq(userFavoriteLanguages.languageCode, languageCode));
}

export async function isLanguageFavorite(userId: number, languageCode: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .select()
    .from(userFavoriteLanguages)
    .where(eq(userFavoriteLanguages.userId, userId))
    .where(eq(userFavoriteLanguages.languageCode, languageCode));
  
  return result.length > 0;
}
