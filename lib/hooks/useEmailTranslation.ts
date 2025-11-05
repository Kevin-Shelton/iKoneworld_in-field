import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface EmailMessage {
  id: string;
  thread_id: string;
  sender_email: string;
  sender_name: string | null;
  sender_language: string;
  original_content: string;
  original_language: string;
  translations: Record<string, string>;
  created_at: string;
  is_outbound: boolean;
  metadata: Record<string, any>;
}

/**
 * Hook to automatically translate email messages to user's preferred language
 * @param messages - Array of email messages
 * @returns Object with translation status and trigger function
 */
export function useEmailTranslation(messages: EmailMessage[]) {
  const { user } = useAuth();
  const [translating, setTranslating] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const userLanguage = user?.user_metadata?.language || 'en';

  useEffect(() => {
    // Auto-translate messages that need translation
    messages.forEach((message) => {
      // Skip if message is already in user's language
      if (message.original_language === userLanguage) {
        return;
      }

      // Skip if translation already exists
      if (message.translations && message.translations[userLanguage]) {
        return;
      }

      // Skip if already translating
      if (translating.has(message.id)) {
        return;
      }

      // Skip if there was an error
      if (errors[message.id]) {
        return;
      }

      // Trigger translation
      translateMessage(message.id, [userLanguage]);
    });
  }, [messages, userLanguage]);

  async function translateMessage(messageId: string, targetLanguages: string[]) {
    setTranslating((prev) => new Set(prev).add(messageId));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[messageId];
      return newErrors;
    });

    try {
      const response = await fetch('/api/email/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          targetLanguages,
        }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Translation failed');
      }

      // Translation successful - the database has been updated
      // The UI will re-fetch or update via realtime subscription
    } catch (error) {
      console.error('Translation error:', error);
      setErrors((prev) => ({
        ...prev,
        [messageId]: error instanceof Error ? error.message : 'Translation failed',
      }));
    } finally {
      setTranslating((prev) => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
  }

  return {
    translating: Array.from(translating),
    errors,
    translateMessage,
  };
}
