/**
 * TTS Cache System
 * Caches synthesized audio for common phrases to enable instant playback
 */

interface CachedAudio {
  blob: Blob;
  url: string;
  timestamp: number;
}

interface TTSCacheStore {
  [key: string]: CachedAudio;
}

// In-memory cache (could be upgraded to IndexedDB for persistence)
const cache: TTSCacheStore = {};

// Cache key format: "voice_id|text|language"
function getCacheKey(voice: string, text: string, language: string): string {
  return `${voice}|${text.toLowerCase().trim()}|${language}`;
}

/**
 * Common phrases in multiple languages for pre-caching
 */
export const COMMON_PHRASES: Record<string, string[]> = {
  // English
  'en': [
    'Hello',
    'Hi',
    'Good morning',
    'Good afternoon',
    'Good evening',
    'How can I help you?',
    'Thank you',
    'You\'re welcome',
    'Please',
    'Excuse me',
    'I understand',
    'One moment please',
    'Have a nice day',
    'Goodbye',
    'See you later',
    'Yes',
    'No',
    'Maybe',
    'I don\'t know',
    'Sorry'
  ],
  // Spanish
  'es': [
    'Hola',
    'Buenos días',
    'Buenas tardes',
    'Buenas noches',
    '¿Cómo puedo ayudarte?',
    'Gracias',
    'De nada',
    'Por favor',
    'Disculpe',
    'Entiendo',
    'Un momento por favor',
    'Que tengas un buen día',
    'Adiós',
    'Hasta luego',
    'Sí',
    'No',
    'Quizás',
    'No sé',
    'Lo siento'
  ],
  // Arabic
  'ar': [
    'مرحبا',
    'صباح الخير',
    'مساء الخير',
    'كيف يمكنني مساعدتك؟',
    'شكرا',
    'على الرحب والسعة',
    'من فضلك',
    'عفوا',
    'أفهم',
    'لحظة من فضلك',
    'أتمنى لك يوما سعيدا',
    'وداعا',
    'أراك لاحقا',
    'نعم',
    'لا',
    'ربما',
    'لا أعرف',
    'آسف'
  ],
  // Chinese (Simplified)
  'zh': [
    '你好',
    '早上好',
    '下午好',
    '晚上好',
    '我能帮你什么？',
    '谢谢',
    '不客气',
    '请',
    '对不起',
    '我明白',
    '请稍等',
    '祝你有美好的一天',
    '再见',
    '回头见',
    '是的',
    '不',
    '也许',
    '我不知道',
    '抱歉'
  ],
  // French
  'fr': [
    'Bonjour',
    'Bonsoir',
    'Comment puis-je vous aider?',
    'Merci',
    'De rien',
    'S\'il vous plaît',
    'Excusez-moi',
    'Je comprends',
    'Un instant s\'il vous plaît',
    'Bonne journée',
    'Au revoir',
    'À plus tard',
    'Oui',
    'Non',
    'Peut-être',
    'Je ne sais pas',
    'Désolé'
  ]
};

/**
 * Get cached audio if available
 */
export function getCachedAudio(voice: string, text: string, language: string): CachedAudio | null {
  const key = getCacheKey(voice, text, language);
  const cached = cache[key];
  
  if (cached) {
    console.log('[TTS Cache] HIT:', text.substring(0, 30));
    return cached;
  }
  
  console.log('[TTS Cache] MISS:', text.substring(0, 30));
  return null;
}

/**
 * Store audio in cache
 */
export function setCachedAudio(voice: string, text: string, language: string, blob: Blob): string {
  const key = getCacheKey(voice, text, language);
  const url = URL.createObjectURL(blob);
  
  cache[key] = {
    blob,
    url,
    timestamp: Date.now()
  };
  
  console.log('[TTS Cache] STORED:', text.substring(0, 30));
  return url;
}

/**
 * Check if text is a common phrase that should be cached
 */
export function isCommonPhrase(text: string, language: string): boolean {
  const baseLanguage = language.split('-')[0];
  const phrases = COMMON_PHRASES[baseLanguage] || [];
  const normalizedText = text.toLowerCase().trim();
  
  return phrases.some(phrase => phrase.toLowerCase() === normalizedText);
}

/**
 * Pre-warm cache with common phrases for a language
 */
export async function warmCache(language: string, voice: string): Promise<void> {
  const baseLanguage = language.split('-')[0];
  const phrases = COMMON_PHRASES[baseLanguage];
  
  if (!phrases || phrases.length === 0) {
    console.log('[TTS Cache] No common phrases for language:', language);
    return;
  }
  
  console.log(`[TTS Cache] Warming cache for ${language} with ${phrases.length} phrases...`);
  
  // Pre-generate audio for common phrases
  const promises = phrases.map(async (phrase) => {
    try {
      const response = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice,
          text: phrase,
          audioFormat: 'Audio16Khz128KBitMp3',
          model: 'default'
        })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        setCachedAudio(voice, phrase, language, blob);
      }
    } catch (err) {
      console.error('[TTS Cache] Failed to cache phrase:', phrase, err);
    }
  });
  
  await Promise.all(promises);
  console.log(`[TTS Cache] Warmed ${phrases.length} phrases for ${language}`);
}

/**
 * Clear old cache entries (older than 1 hour)
 */
export function clearOldCache(maxAge: number = 3600000): void {
  const now = Date.now();
  let cleared = 0;
  
  Object.keys(cache).forEach(key => {
    if (now - cache[key].timestamp > maxAge) {
      URL.revokeObjectURL(cache[key].url);
      delete cache[key];
      cleared++;
    }
  });
  
  if (cleared > 0) {
    console.log(`[TTS Cache] Cleared ${cleared} old entries`);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  const entries = Object.keys(cache);
  return {
    size: entries.length,
    entries: entries.map(key => {
      const parts = key.split('|');
      return parts[1]; // Return just the text part
    })
  };
}
