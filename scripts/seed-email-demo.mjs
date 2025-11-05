/**
 * Seed script for email demo data
 * Creates sample email threads and messages for testing
 */

import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
});

async function seedEmailDemo() {
  try {
    console.log('🌱 Seeding email demo data...\n');

    // Create sample thread 1: English <-> Spanish
    console.log('Creating English-Spanish thread...');
    const [thread1] = await sql`
      INSERT INTO email_threads (subject, participants, last_message_at, is_demo, metadata)
      VALUES (
        'Product Inquiry - Translation Demo',
        ${JSON.stringify([
          { email: 'employee@ikoneworld.com', name: 'Sarah Johnson', language: 'en' },
          { email: 'cliente@ejemplo.es', name: 'Carlos García', language: 'es' }
        ])}::jsonb,
        NOW(),
        true,
        ${JSON.stringify({ demo_type: 'product_inquiry', auto_created: true })}::jsonb
      )
      RETURNING id
    `;

    // Add messages to thread 1
    await sql`
      INSERT INTO email_messages (thread_id, sender_email, sender_name, sender_language, original_content, original_language, translations, is_outbound, created_at)
      VALUES
        (
          ${thread1.id},
          'cliente@ejemplo.es',
          'Carlos García',
          'es',
          '¡Hola! Estoy interesado en sus servicios de traducción. ¿Podrían proporcionarme más información sobre los precios y los idiomas disponibles?',
          'es',
          ${JSON.stringify({
            en: 'Hello! I am interested in your translation services. Could you provide me with more information about pricing and available languages?'
          })}::jsonb,
          false,
          NOW() - INTERVAL '2 hours'
        ),
        (
          ${thread1.id},
          'employee@ikoneworld.com',
          'Sarah Johnson',
          'en',
          'Thank you for your interest! We offer translation services in over 120 languages. Our pricing starts at $0.10 per word for standard translations. Would you like to schedule a consultation call?',
          'en',
          ${JSON.stringify({
            es: '¡Gracias por su interés! Ofrecemos servicios de traducción en más de 120 idiomas. Nuestros precios comienzan en $0.10 por palabra para traducciones estándar. ¿Le gustaría programar una llamada de consulta?'
          })}::jsonb,
          true,
          NOW() - INTERVAL '1 hour'
        )
    `;

    console.log('✅ Thread 1 created with 2 messages\n');

    // Create sample thread 2: English <-> French
    console.log('Creating English-French thread...');
    const [thread2] = await sql`
      INSERT INTO email_threads (subject, participants, last_message_at, is_demo, metadata)
      VALUES (
        'Partnership Opportunity',
        ${JSON.stringify([
          { email: 'employee@ikoneworld.com', name: 'Sarah Johnson', language: 'en' },
          { email: 'contact@exemple.fr', name: 'Marie Dubois', language: 'fr' }
        ])}::jsonb,
        NOW(),
        true,
        ${JSON.stringify({ demo_type: 'partnership', auto_created: true })}::jsonb
      )
      RETURNING id
    `;

    await sql`
      INSERT INTO email_messages (thread_id, sender_email, sender_name, sender_language, original_content, original_language, translations, is_outbound, created_at)
      VALUES
        (
          ${thread2.id},
          'contact@exemple.fr',
          'Marie Dubois',
          'fr',
          'Bonjour, je représente une entreprise française et nous recherchons un partenaire pour nos besoins de traduction. Pouvons-nous discuter d''une collaboration potentielle?',
          'fr',
          ${JSON.stringify({
            en: 'Hello, I represent a French company and we are looking for a partner for our translation needs. Can we discuss a potential collaboration?'
          })}::jsonb,
          false,
          NOW() - INTERVAL '3 hours'
        )
    `;

    console.log('✅ Thread 2 created with 1 message\n');

    // Create sample thread 3: English <-> Japanese
    console.log('Creating English-Japanese thread...');
    const [thread3] = await sql`
      INSERT INTO email_threads (subject, participants, last_message_at, is_demo, metadata)
      VALUES (
        'Technical Documentation Translation',
        ${JSON.stringify([
          { email: 'employee@ikoneworld.com', name: 'Sarah Johnson', language: 'en' },
          { email: 'tanaka@example.jp', name: 'Yuki Tanaka', language: 'ja' }
        ])}::jsonb,
        NOW(),
        true,
        ${JSON.stringify({ demo_type: 'technical', auto_created: true })}::jsonb
      )
      RETURNING id
    `;

    await sql`
      INSERT INTO email_messages (thread_id, sender_email, sender_name, sender_language, original_content, original_language, translations, is_outbound, created_at)
      VALUES
        (
          ${thread3.id},
          'tanaka@example.jp',
          'Yuki Tanaka',
          'ja',
          'こんにちは。技術文書の翻訳サービスについてお聞きしたいです。専門用語の用語集機能はありますか？',
          'ja',
          ${JSON.stringify({
            en: 'Hello. I would like to inquire about your technical documentation translation services. Do you have a glossary feature for specialized terminology?'
          })}::jsonb,
          false,
          NOW() - INTERVAL '5 hours'
        ),
        (
          ${thread3.id},
          'employee@ikoneworld.com',
          'Sarah Johnson',
          'en',
          'Yes! We have a custom glossary feature that allows you to define specialized terms and ensure consistent translation across all your documents. This is especially useful for technical and industry-specific content.',
          'en',
          ${JSON.stringify({
            ja: 'はい！カスタム用語集機能があり、専門用語を定義して、すべてのドキュメントで一貫した翻訳を確保できます。これは技術的および業界固有のコンテンツに特に役立ちます。'
          })}::jsonb,
          true,
          NOW() - INTERVAL '4 hours'
        )
    `;

    console.log('✅ Thread 3 created with 2 messages\n');

    console.log('🎉 Email demo data seeded successfully!');
    console.log('\nCreated:');
    console.log('  - 3 email threads');
    console.log('  - 5 messages with translations');
    console.log('  - Languages: English, Spanish, French, Japanese\n');

  } catch (error) {
    console.error('❌ Error seeding email demo data:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

seedEmailDemo();
