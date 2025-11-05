'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Inbox, 
  Send as SendIcon, 
  Mail, 
  MailOpen, 
  Loader2, 
  BookOpen,
  Languages,
  Eye,
  EyeOff,
  ArrowLeft,
  Reply as ReplyIcon
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';

interface EmailThread {
  id: string;
  subject: string;
  participants: Array<{
    email: string;
    name: string;
    language: string;
  }>;
  last_message_at: string;
  is_demo: boolean;
}

interface EmailMessage {
  id: string;
  thread_id: string;
  sender_email: string;
  sender_name: string;
  sender_language: string;
  original_content: string;
  original_language: string;
  translations: Record<string, string>;
  is_outbound: boolean;
  created_at: string;
}

export default function EmailInboxPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});

  const userLanguage = user?.user_metadata?.language || 'en';

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
        .order('last_message_at', { ascending: false });

      if (fetchError) throw fetchError;

      setThreads(data || []);
      
      // Auto-select first thread
      if (data && data.length > 0) {
        selectThread(data[0]);
      }
    } catch (err) {
      console.error('Error loading threads:', err);
      setError('Failed to load email threads');
    } finally {
      setLoading(false);
    }
  }

  async function selectThread(thread: EmailThread) {
    setSelectedThread(thread);
    setLoadingMessages(true);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('email_messages')
        .select('*')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      setMessages(data || []);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  }

  async function handleSendReply() {
    if (!replyContent.trim() || !selectedThread || !user) return;

    try {
      setSending(true);

      const recipient = selectedThread.participants.find(
        p => p.email !== user.email
      ) || selectedThread.participants[0];

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId: selectedThread.id,
          content: replyContent,
          senderLanguage: userLanguage,
          recipientLanguage: recipient.language,
          senderEmail: user.email || 'unknown@example.com',
          senderName: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const newMessage = await response.json();
      setMessages([...messages, newMessage.message]);
      setReplyContent('');
    } catch (err) {
      console.error('Error sending reply:', err);
      setError('Failed to send reply');
    } finally {
      setSending(false);
    }
  }

  function getMessageContent(message: EmailMessage): string {
    const isShowingOriginal = showOriginal[message.id];
    
    if (isShowingOriginal) {
      return message.original_content;
    }

    // Show translation if available and user's language is different
    if (message.original_language !== userLanguage && message.translations[userLanguage]) {
      return message.translations[userLanguage];
    }

    return message.original_content;
  }

  function toggleOriginal(messageId: string) {
    setShowOriginal(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  }

  const folders = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: threads.length },
    { id: 'sent', label: 'Sent', icon: SendIcon, count: 0 },
    { id: 'drafts', label: 'Drafts', icon: Mail, count: 0 },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Navigation />
      
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Folders */}
        <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white">Email</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {folders.map((folder) => {
              const Icon = folder.icon;
              return (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolder(folder.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg mb-1 transition-colors ${
                    selectedFolder === folder.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{folder.label}</span>
                  </div>
                  {folder.count > 0 && (
                    <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">
                      {folder.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-4 border-t border-slate-800">
            <Button
              onClick={() => router.push('/email/glossary')}
              variant="outline"
              className="w-full border-purple-500/20 text-purple-400 hover:bg-purple-500/10"
              size="sm"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Glossary
            </Button>
          </div>
        </div>

        {/* Middle - Thread List */}
        <div className="w-96 bg-slate-900/50 border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-white">
              {folders.find(f => f.id === selectedFolder)?.label || 'Inbox'}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-3 bg-slate-800 rounded-lg animate-pulse">
                    <div className="h-4 bg-slate-700 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-700 rounded w-1/2" />
                  </div>
                ))}
              </div>
            )}

            {!loading && threads.map((thread) => {
              const otherParticipant = thread.participants.find(p => p.email !== user?.email) || thread.participants[0];
              const isSelected = selectedThread?.id === thread.id;

              return (
                <button
                  key={thread.id}
                  onClick={() => selectThread(thread)}
                  className={`w-full p-4 border-b border-slate-800 text-left transition-colors ${
                    isSelected
                      ? 'bg-slate-800'
                      : 'hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-semibold text-white text-sm">
                      {otherParticipant.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="text-sm text-white mb-1 font-medium">
                    {thread.subject}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {otherParticipant.language.toUpperCase()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right - Message Preview */}
        <div className="flex-1 bg-slate-950 flex flex-col">
          {!selectedThread && (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              <div className="text-center">
                <Mail className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select an email to view</p>
              </div>
            </div>
          )}

          {selectedThread && (
            <>
              {/* Email Header */}
              <div className="p-6 border-b border-slate-800">
                <h1 className="text-2xl font-bold text-white mb-4">{selectedThread.subject}</h1>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span>{selectedThread.participants.length} participants</span>
                  <span>•</span>
                  <span>
                    {selectedThread.participants.map(p => p.language.toUpperCase()).join(', ')}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {loadingMessages && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                  </div>
                )}

                {!loadingMessages && messages.map((message) => {
                  const isShowingOriginal = showOriginal[message.id];
                  const hasTranslation = message.translations[userLanguage] && message.original_language !== userLanguage;

                  return (
                    <Card key={message.id} className="p-6 bg-slate-900/50 border-slate-800">
                      {/* Message Header */}
                      <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-800">
                        <div>
                          <div className="font-semibold text-white mb-1">
                            {message.sender_name}
                          </div>
                          <div className="text-sm text-slate-400">
                            {message.sender_email}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-slate-400 mb-1">
                            {new Date(message.created_at).toLocaleString()}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              isShowingOriginal
                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                : 'bg-green-500/10 text-green-400 border border-green-500/20'
                            }`}>
                              {isShowingOriginal 
                                ? message.original_language.toUpperCase() 
                                : (hasTranslation ? `${userLanguage.toUpperCase()} (Translated)` : message.original_language.toUpperCase())
                              }
                            </span>
                            {hasTranslation && (
                              <button
                                onClick={() => toggleOriginal(message.id)}
                                className="text-slate-400 hover:text-white transition-colors"
                                title={isShowingOriginal ? 'Show translation' : 'Show original'}
                              >
                                {isShowingOriginal ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Message Content */}
                      <div className="text-slate-200 whitespace-pre-wrap">
                        {getMessageContent(message)}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Reply Box */}
              <div className="p-6 border-t border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-2 mb-3 text-sm text-slate-400">
                  <Languages className="w-4 h-4" />
                  <span>Reply in {userLanguage.toUpperCase()} • Auto-translates to recipient's language</span>
                </div>
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Type your reply..."
                  className="mb-3 bg-slate-950 border-slate-800 text-white resize-none"
                  rows={4}
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleSendReply}
                    disabled={sending || !replyContent.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <ReplyIcon className="w-4 h-4 mr-2" />
                        Send Reply
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
