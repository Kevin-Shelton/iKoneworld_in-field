import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Parse CSV line with proper quote handling
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Parse CSV file
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

// Favorite languages list (as specified in FRD)
const FAVORITE_LANGUAGE_CODES = [
  'es-MX', 'es-ES', // Spanish
  'vi-VN', // Vietnamese
  'pt-BR', 'pt-PT', // Portuguese
  'ko-KR', // Korean
  'ar-SA', 'ar-AE', // Arabic
  'de-DE', // German
  'ru-RU', // Russian
  'fr-FR', // French
  'ja-JP', // Japanese
];

async function migrateLanguageData() {
  let connection;
  
  try {
    console.log('Connecting to database...');
    connection = await createConnection(DATABASE_URL);
    console.log('Connected successfully');

    // Read CSV files
    console.log('\nReading CSV files...');
    const sttContent = readFileSync(join(__dirname, '..', 'stt-lang.csv'), 'utf-8');
    const ttsContent = readFileSync(join(__dirname, '..', 'tts-voices.csv'), 'utf-8');
    const tttContent = readFileSync(join(__dirname, '..', 'ttt-lang.csv'), 'utf-8');

    const sttData = parseCSV(sttContent);
    const ttsData = parseCSV(ttsContent);
    const tttData = parseCSV(tttContent);

    console.log(`Loaded ${sttData.length} STT languages`);
    console.log(`Loaded ${ttsData.length} TTS voices`);
    console.log(`Loaded ${tttData.length} TTT languages`);

    // Clear existing data
    console.log('\nClearing existing language data...');
    await connection.query('DELETE FROM tts_voices');
    await connection.query('DELETE FROM stt_languages');
    await connection.query('DELETE FROM ttt_languages');
    await connection.query('DELETE FROM languages');
    console.log('Existing data cleared');

    // Insert STT languages
    console.log('\nInserting STT languages...');
    for (const row of sttData) {
      const [code, lang, origin, displayLang, displayOrigin] = Object.values(row);
      await connection.query(
        'INSERT INTO stt_languages (code, lang, origin, displayLang, displayOrigin) VALUES (?, ?, ?, ?, ?)',
        [code, lang, origin, displayLang, displayOrigin]
      );
    }
    console.log(`Inserted ${sttData.length} STT languages`);

    // Insert TTS voices
    console.log('\nInserting TTS voices...');
    for (const row of ttsData) {
      const [language, voice, gender] = Object.values(row);
      await connection.query(
        'INSERT INTO tts_voices (language, voice, gender) VALUES (?, ?, ?)',
        [language, voice, gender]
      );
    }
    console.log(`Inserted ${ttsData.length} TTS voices`);

    // Insert TTT languages
    console.log('\nInserting TTT languages...');
    for (const row of tttData) {
      const [code, name, nativeName, direction] = Object.values(row);
      await connection.query(
        'INSERT INTO ttt_languages (code, name, nativeName, direction) VALUES (?, ?, ?, ?)',
        [code, name, nativeName, direction]
      );
    }
    console.log(`Inserted ${tttData.length} TTT languages`);

    // Build comprehensive languages table from STT data
    console.log('\nBuilding comprehensive languages table...');
    const languageMap = new Map();
    
    for (const row of sttData) {
      const [code, lang, origin, displayLang, displayOrigin] = Object.values(row);
      const baseCode = lang;
      const countryCode = origin;
      const name = `${displayLang} (${displayOrigin})`;
      const isFavorite = FAVORITE_LANGUAGE_CODES.includes(code);
      
      // Get direction from TTT data
      const tttLang = tttData.find(t => Object.values(t)[0] === baseCode);
      const direction = tttLang ? Object.values(tttLang)[3] : 'ltr';
      
      // Get native name from TTT data
      const nativeName = tttLang ? Object.values(tttLang)[2] : displayLang;
      
      languageMap.set(code, {
        code,
        baseCode,
        name,
        nativeName,
        direction,
        countryCode,
        isFavorite
      });
    }

    for (const [code, lang] of languageMap) {
      await connection.query(
        'INSERT INTO languages (code, baseCode, name, nativeName, direction, countryCode, isFavorite) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [lang.code, lang.baseCode, lang.name, lang.nativeName, lang.direction, lang.countryCode, lang.isFavorite]
      );
    }
    console.log(`Inserted ${languageMap.size} languages`);

    // Summary
    console.log('\n=== Migration Summary ===');
    console.log(`✓ ${sttData.length} STT languages imported`);
    console.log(`✓ ${ttsData.length} TTS voices imported`);
    console.log(`✓ ${tttData.length} TTT languages imported`);
    console.log(`✓ ${languageMap.size} comprehensive languages created`);
    console.log(`✓ ${FAVORITE_LANGUAGE_CODES.length} favorite languages marked`);
    console.log('\nMigration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed');
    }
  }
}

migrateLanguageData();
