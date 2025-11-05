-- Seed data for email demo
-- Run this in Supabase SQL Editor to create sample email threads and messages

-- Thread 1: English <-> Spanish (Product Inquiry)
DO $$
DECLARE
  thread1_id UUID;
BEGIN
  INSERT INTO email_threads (subject, participants, last_message_at, is_demo, metadata)
  VALUES (
    'Product Inquiry - Translation Demo',
    '[
      {"email": "employee@ikoneworld.com", "name": "Sarah Johnson", "language": "en"},
      {"email": "cliente@ejemplo.es", "name": "Carlos García", "language": "es"}
    ]'::jsonb,
    NOW(),
    true,
    '{"demo_type": "product_inquiry", "auto_created": true}'::jsonb
  )
  RETURNING id INTO thread1_id;

  INSERT INTO email_messages (thread_id, sender_email, sender_name, sender_language, original_content, original_language, translations, is_outbound, created_at)
  VALUES
    (
      thread1_id,
      'cliente@ejemplo.es',
      'Carlos García',
      'es',
      '¡Hola! Estoy interesado en sus servicios de traducción. ¿Podrían proporcionarme más información sobre los precios y los idiomas disponibles?',
      'es',
      '{"en": "Hello! I am interested in your translation services. Could you provide me with more information about pricing and available languages?"}'::jsonb,
      false,
      NOW() - INTERVAL '2 hours'
    ),
    (
      thread1_id,
      'employee@ikoneworld.com',
      'Sarah Johnson',
      'en',
      'Thank you for your interest! We offer translation services in over 120 languages. Our pricing starts at $0.10 per word for standard translations. Would you like to schedule a consultation call?',
      'en',
      '{"es": "¡Gracias por su interés! Ofrecemos servicios de traducción en más de 120 idiomas. Nuestros precios comienzan en $0.10 por palabra para traducciones estándar. ¿Le gustaría programar una llamada de consulta?"}'::jsonb,
      true,
      NOW() - INTERVAL '1 hour'
    );
END $$;

-- Thread 2: English <-> French (Partnership)
DO $$
DECLARE
  thread2_id UUID;
BEGIN
  INSERT INTO email_threads (subject, participants, last_message_at, is_demo, metadata)
  VALUES (
    'Partnership Opportunity',
    '[
      {"email": "employee@ikoneworld.com", "name": "Sarah Johnson", "language": "en"},
      {"email": "contact@exemple.fr", "name": "Marie Dubois", "language": "fr"}
    ]'::jsonb,
    NOW(),
    true,
    '{"demo_type": "partnership", "auto_created": true}'::jsonb
  )
  RETURNING id INTO thread2_id;

  INSERT INTO email_messages (thread_id, sender_email, sender_name, sender_language, original_content, original_language, translations, is_outbound, created_at)
  VALUES
    (
      thread2_id,
      'contact@exemple.fr',
      'Marie Dubois',
      'fr',
      'Bonjour, je représente une entreprise française et nous recherchons un partenaire pour nos besoins de traduction. Pouvons-nous discuter d''une collaboration potentielle?',
      'fr',
      '{"en": "Hello, I represent a French company and we are looking for a partner for our translation needs. Can we discuss a potential collaboration?"}'::jsonb,
      false,
      NOW() - INTERVAL '3 hours'
    );
END $$;

-- Thread 3: English <-> Japanese (Technical)
DO $$
DECLARE
  thread3_id UUID;
BEGIN
  INSERT INTO email_threads (subject, participants, last_message_at, is_demo, metadata)
  VALUES (
    'Technical Documentation Translation',
    '[
      {"email": "employee@ikoneworld.com", "name": "Sarah Johnson", "language": "en"},
      {"email": "tanaka@example.jp", "name": "Yuki Tanaka", "language": "ja"}
    ]'::jsonb,
    NOW(),
    true,
    '{"demo_type": "technical", "auto_created": true}'::jsonb
  )
  RETURNING id INTO thread3_id;

  INSERT INTO email_messages (thread_id, sender_email, sender_name, sender_language, original_content, original_language, translations, is_outbound, created_at)
  VALUES
    (
      thread3_id,
      'tanaka@example.jp',
      'Yuki Tanaka',
      'ja',
      'こんにちは。技術文書の翻訳サービスについてお聞きしたいです。専門用語の用語集機能はありますか？',
      'ja',
      '{"en": "Hello. I would like to inquire about your technical documentation translation services. Do you have a glossary feature for specialized terminology?"}'::jsonb,
      false,
      NOW() - INTERVAL '5 hours'
    ),
    (
      thread3_id,
      'employee@ikoneworld.com',
      'Sarah Johnson',
      'en',
      'Yes! We have a custom glossary feature that allows you to define specialized terms and ensure consistent translation across all your documents. This is especially useful for technical and industry-specific content.',
      'en',
      '{"ja": "はい！カスタム用語集機能があり、専門用語を定義して、すべてのドキュメントで一貫した翻訳を確保できます。これは技術的および業界固有のコンテンツに特に役立ちます。"}'::jsonb,
      true,
      NOW() - INTERVAL '4 hours'
    );
END $$;

-- Verify the data
SELECT 
  'Email Threads' as table_name,
  COUNT(*) as count
FROM email_threads
WHERE is_demo = true

UNION ALL

SELECT 
  'Email Messages' as table_name,
  COUNT(*) as count
FROM email_messages
WHERE thread_id IN (SELECT id FROM email_threads WHERE is_demo = true);
