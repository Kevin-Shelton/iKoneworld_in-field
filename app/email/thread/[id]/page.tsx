'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, 
  Send, 
  Loader2, 
  Languages,
  Eye,
  EyeOff
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useEmailTranslation } from '@/lib/hooks/useEmailTranslation';

interface EmailThread {
  id: string;
  subject: string;
  participants: Array<{
    email: string;
    name: string;
    language: string;
  }>;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  is_demo: boolean;
  metadata: Record<string, any>;
}

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

export default function EmailThreadPage() {
  const router = useRouter();
  const params = useParams();
  const threadId = params.id as string;
  const { user } = useAuth();

  const [thread, setThread] = useState<EmailThread | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});

  const supabase = createClient();
  const { translating, translateMessage } = useEmailTranslation(messages);

  useEffect(() => {
    if (threadId) {
      loadThread();
      loadMessages();
    }
  }, [threadId]);

  async function loadThread() {
    try {
      const { data, error: fetchError } = await supabase
        .from('email_threads')
        .select('*')
        .eq('id', threadId)
        .single();

      if (fetchError) throw fetchError;
      setThread(data);
    } catch (err) {
      console.error('Error loading thread:', err);
      setError('Failed to load email thread');
    }
  }

  async function loadMessages() {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('email_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      setMessages(data || []);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendReply() {
    if (!replyContent.trim() || !user || !thread) return;

    try {
      setSending(true);
      setError(null);

      // Get user's language from profile
      const userLanguage = user.user_metadata?.language || 'en';
      
      // Get recipient (other participant)
      const recipient = thread.participants.find(
        p => p.email !== user.email
      ) || thread.participants[0];

      // Call API to send message with translation
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId,
          content: replyContent,
          senderLanguage: userLanguage,
          recipientLanguage: recipient.language,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      if (data.success && data.message) {
        // Add to local state
        setMessages([...messages, data.message]);
        setReplyContent('');
        
        if (data.warning) {
          console.warn(data.warning);
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Error sending reply:', err);
      setError('Failed to send reply');
    } finally {
      setSending(false);
    }
  }

  function toggleShowOriginal(messageId: string) {
    setShowOriginal(prev => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  }

  function getMessageContent(message: EmailMessage): string {
    const userLanguage = user?.user_metadata?.language || 'en';
    const isShowingOriginal = showOriginal[message.id];

    if (isShowingOriginal) {
      return message.original_content;
    }

    // If message is in user's language, show original
    if (message.original_language === userLanguage) {
      return message.original_content;
    }

    // Otherwise, show translation if available
    return message.translations[userLanguage] || message.original_content;
  }

  function getLanguageLabel(message: EmailMessage): string {
    const userLanguage = user?.user_metadata?.language || 'en';
    const isShowingOriginal = showOriginal[message.id];

    if (isShowingOriginal) {
      return message.original_language.toUpperCase();
    }

    if (message.original_language === userLanguage) {
      return message.original_language.toUpperCase();
    }

    return message.translations[userLanguage] 
      ? `${userLanguage.toUpperCase()} (Translated)`
      : message.original_language.toUpperCase();
  }

  const isOwnMessage = (message: EmailMessage) => {
    return message.sender_email === user?.email;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/email')}
            className="mb-4 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inbox
          </Button>

          {thread && (
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">{thread.subject}</h1>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span>
                  {thread.participants.length} participant{thread.participants.length !== 1 ? 's' : ''}
                </span>
                <span>•</span>
                <span>
                  {thread.participants.map(p => p.language.toUpperCase()).join(', ')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="p-6 bg-red-500/10 border-red-500/20 mb-6">
            <p className="text-red-400">{error}</p>
          </Card>
        )}

        {/* Messages */}
        {!loading && messages.length > 0 && (
          <div className="space-y-4 mb-6">
            {messages.map((message) => {
              const isOwn = isOwnMessage(message);
              const content = getMessageContent(message);
              const languageLabel = getLanguageLabel(message);
              const canToggle = message.original_language !== (user?.user_metadata?.language || 'en');

              return (
                <Card
                  key={message.id}
                  className={`p-4 ${
                    isOwn
                      ? 'bg-blue-500/10 border-blue-500/20 ml-auto max-w-[80%]'
                      : 'bg-slate-900/50 border-slate-800 mr-auto max-w-[80%]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-semibold text-white text-sm">
                        {message.sender_name || message.sender_email}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(message.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                        {languageLabel}
                      </span>
                      {canToggle && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleShowOriginal(message.id)}
                          className="h-6 w-6 p-0"
                        >
                          {showOriginal[message.id] ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <Languages className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-200 whitespace-pre-wrap">{content}</p>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && messages.length === 0 && (
          <Card className="p-12 text-center bg-slate-900/50 border-slate-800 mb-6">
            <p className="text-slate-400">No messages in this thread yet.</p>
          </Card>
        )}

        {/* Reply Box */}
        {thread && (
          <Card className="p-4 bg-slate-900/50 border-slate-800 sticky bottom-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Languages className="h-4 w-4" />
                <span>
                  Reply in {user?.user_metadata?.language?.toUpperCase() || 'EN'} 
                  {' • '}Auto-translates to recipient's language
                </span>
              </div>
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Type your reply..."
                className="min-h-[100px] bg-slate-950 border-slate-800 text-white resize-none"
                disabled={sending}
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSendReply}
                  disabled={!replyContent.trim() || sending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Reply
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
}
