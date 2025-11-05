'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Inbox, Mail, MailOpen, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

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
  unread?: boolean;
  preview?: string;
}

export default function EmailInboxPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadThreads();
  }, []);

  async function loadThreads() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('email_threads')
        .select('*')
        .eq('is_demo', true)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setThreads(data || []);
    } catch (err) {
      console.error('Error loading email threads:', err);
      setError('Failed to load email threads');
    } finally {
      setLoading(false);
    }
  }

  function openThread(threadId: string) {
    router.push(`/email/thread/${threadId}`);
  }

  function getOtherParticipant(thread: EmailThread, currentUserEmail?: string) {
    if (!thread.participants || thread.participants.length === 0) {
      return { name: 'Unknown', email: 'unknown@example.com', language: 'en' };
    }
    
    // For demo, just return the first non-employee participant or the first participant
    const otherParticipant = thread.participants.find(
      p => !p.email.includes('ikoneworld')
    ) || thread.participants[0];
    
    return otherParticipant;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Inbox className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Email Inbox</h1>
              <p className="text-slate-400">Multi-language email translation demo</p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="p-6 bg-red-500/10 border-red-500/20">
            <p className="text-red-400">{error}</p>
            <Button 
              onClick={loadThreads} 
              variant="outline" 
              className="mt-4"
            >
              Retry
            </Button>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && threads.length === 0 && (
          <Card className="p-12 text-center bg-slate-900/50 border-slate-800">
            <Inbox className="h-16 w-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-semibold text-white mb-2">No emails yet</h3>
            <p className="text-slate-400">
              Your email inbox is empty. New translated emails will appear here.
            </p>
          </Card>
        )}

        {/* Thread List */}
        {!loading && !error && threads.length > 0 && (
          <div className="space-y-2">
            {threads.map((thread) => {
              const otherParticipant = getOtherParticipant(thread);
              const isUnread = thread.unread ?? false;
              
              return (
                <Card
                  key={thread.id}
                  className={`p-4 cursor-pointer transition-all hover:bg-slate-800/50 border-slate-800 ${
                    isUnread ? 'bg-slate-900/80' : 'bg-slate-900/50'
                  }`}
                  onClick={() => openThread(thread.id)}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="mt-1">
                      {isUnread ? (
                        <Mail className="h-5 w-5 text-blue-400" />
                      ) : (
                        <MailOpen className="h-5 w-5 text-slate-500" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-base font-semibold truncate ${
                            isUnread ? 'text-white' : 'text-slate-300'
                          }`}>
                            {otherParticipant.name}
                          </h3>
                          <p className="text-sm text-slate-500 truncate">
                            {otherParticipant.email}
                          </p>
                        </div>
                        <div className="text-xs text-slate-500 whitespace-nowrap">
                          {thread.last_message_at
                            ? formatDistanceToNow(new Date(thread.last_message_at), {
                                addSuffix: true,
                              })
                            : formatDistanceToNow(new Date(thread.created_at), {
                                addSuffix: true,
                              })}
                        </div>
                      </div>

                      <p className={`text-sm mb-1 truncate ${
                        isUnread ? 'text-white' : 'text-slate-400'
                      }`}>
                        {thread.subject}
                      </p>

                      {thread.preview && (
                        <p className="text-sm text-slate-500 truncate">
                          {thread.preview}
                        </p>
                      )}

                      {/* Language badge */}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {otherParticipant.language.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
