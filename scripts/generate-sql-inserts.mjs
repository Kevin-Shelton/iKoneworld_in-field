import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Helper function to escape SQL strings
function escapeSql(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// Parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || null;
    });
    return row;
  });
}

console.log('-- iK OneWorld Language Data Migration');
console.log('-- Generated on:', new Date().toISOString());
console.log('-- Run this after creating the schema\n');

// Process STT Languages
console.log('-- Insert STT Languages (Speech-to-Text)');
const sttData = parseCSV(path.join(projectRoot, 'stt-lang.csv'));
const sttInserts = sttData.map(row => {
  return `INSERT INTO stt_languages (code, lang, origin, "displayLang", "displayOrigin") VALUES (${escapeSql(row.code)}, ${escapeSql(row.lang)}, ${escapeSql(row.origin)}, ${escapeSql(row.displayLang)}, ${escapeSql(row.displayOrigin)});`;
});
console.log(sttInserts.join('\n'));

// Process TTS Voices
console.log('\n-- Insert TTS Voices (Text-to-Speech)');
const ttsData = parseCSV(path.join(projectRoot, 'tts-voices.csv'));
const ttsInserts = ttsData.map(row => {
  return `INSERT INTO tts_voices (language, voice, gender) VALUES (${escapeSql(row.language)}, ${escapeSql(row.voice)}, ${escapeSql(row.gender)});`;
});
console.log(ttsInserts.join('\n'));

// Process TTT Languages
console.log('\n-- Insert TTT Languages (Text-to-Text Translation)');
const tttData = parseCSV(path.join(projectRoot, 'ttt-lang.csv'));
const tttInserts = tttData.map(row => {
  // Ensure direction has a default value if missing
  const direction = row.direction || 'ltr';
  return `INSERT INTO ttt_languages (code, name, "nativeName", direction) VALUES (${escapeSql(row.code)}, ${escapeSql(row.name)}, ${escapeSql(row.nativeName)}, '${direction}');`;
});
console.log(tttInserts.join('\n'));

// Generate comprehensive languages table from STT data
console.log('\n-- Insert Languages (Main language metadata)');
const languagesMap = new Map();
const favoriteLanguages = ['es', 'vi', 'pt', 'ko', 'ar', 'de', 'ru', 'fr', 'ja', 'zh', 'hi', 'it'];

sttData.forEach(row => {
  const baseCode = row.lang;
  if (!languagesMap.has(row.code)) {
    languagesMap.set(row.code, {
      code: row.code,
      baseCode: baseCode,
      name: row.displayLang || row.lang,
      nativeName: row.displayOrigin || null,
      direction: (baseCode === 'ar' || baseCode === 'he' || baseCode === 'fa' || baseCode === 'ur') ? 'rtl' : 'ltr',
      countryCode: row.origin || null,
      isFavorite: favoriteLanguages.includes(baseCode)
    });
  }
});

const languageInserts = Array.from(languagesMap.values()).map(lang => {
  return `INSERT INTO languages (code, "baseCode", name, "nativeName", direction, "countryCode", "isFavorite") VALUES (${escapeSql(lang.code)}, ${escapeSql(lang.baseCode)}, ${escapeSql(lang.name)}, ${escapeSql(lang.nativeName)}, ${escapeSql(lang.direction)}, ${escapeSql(lang.countryCode)}, ${lang.isFavorite});`;
});
console.log(languageInserts.join('\n'));

console.log('\n-- Migration complete!');
console.log(`-- Inserted ${sttInserts.length} STT languages`);
console.log(`-- Inserted ${ttsInserts.length} TTS voices`);
console.log(`-- Inserted ${tttInserts.length} TTT languages`);
console.log(`-- Inserted ${languageInserts.length} languages`);
