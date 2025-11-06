'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Inbox, 
  Send as SendIcon, 
  Mail, 
  Loader2, 
  BookOpen,
  Languages,
  Eye,
  EyeOff,
  Reply as ReplyIcon,
  ReplyAll,
  Forward,
  Plus
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { EmailComposer } from '@/components/EmailComposer';

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

type ComposerMode = 'compose' | 'reply' | 'reply-all' | 'forward' | null;

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
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const [composerMode, setComposerMode] = useState<ComposerMode>(null);

  const userLanguage = user?.user_metadata?.language || 'en';
  const userEmail = user?.email || '';

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
      
      // Auto-select first thread if not composing
      if (data && data.length > 0 && !composerMode) {
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
    setComposerMode(null); // Close composer when selecting a thread
    setLoadingMessages(true);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('email_messages')
        .select('*')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true});

      if (fetchError) throw fetchError;

      setMessages(data || []);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoadingMessages(false);
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

  function handleComposeNew() {
    setComposerMode('compose');
    setSelectedThread(null);
  }

  function handleReply() {
    if (!selectedThread || !messages.length) return;
    
    const lastMessage = messages[messages.length - 1];
    const sender = {
      email: lastMessage.sender_email,
      name: lastMessage.sender_name,
      language: lastMessage.sender_language,
      isKnown: true,
    };

    setComposerMode('reply');
  }

  function handleReplyAll() {
    if (!selectedThread) return;
    setComposerMode('reply-all');
  }

  function handleForward() {
    if (!selectedThread) return;
    setComposerMode('forward');
  }

  async function handleComposerSend() {
    setComposerMode(null);
    await loadThreads(); // Reload threads
    
    // Refresh messages for the currently selected thread
    if (selectedThread) {
      selectThread(selectedThread);
    }
  }

  function handleComposerCancel() {
    setComposerMode(null);
  }

  function getComposerRecipients() {
    if (!selectedThread) return [];

    switch (composerMode) {
      case 'reply': {
        const lastMessage = messages[messages.length - 1];
        return [{
          email: lastMessage.sender_email,
          name: lastMessage.sender_name,
          language: lastMessage.sender_language,
          isKnown: true,
        }];
      }
      case 'reply-all': {
        return selectedThread.participants
          .filter(p => p.email !== userEmail)
          .map(p => ({
            email: p.email,
            name: p.name,
            language: p.language,
            isKnown: true,
          }));
      }
      case 'forward':
      case 'compose':
      default:
        return [];
    }
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
            <Button
              onClick={handleComposeNew}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Compose New
            </Button>
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
              // Find the customer (non-ikoneworld email) as the recipient
              const recipient = thread.participants.find(p => 
                !p.email.includes('ikoneworld.com') && !p.email.includes('example.com')
              ) || thread.participants.find(p => p.email !== user?.email) || thread.participants[0];
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
                      {recipient.name}
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
                      {recipient.language.toUpperCase()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right - Message Preview or Composer */}
        <div className="flex-1 bg-slate-950 flex flex-col">
          {composerMode ? (
            <div className="p-6 overflow-y-auto">
              <EmailComposer
                mode={composerMode}
                threadId={selectedThread?.id}
                initialRecipients={getComposerRecipients()}
                initialSubject={
                  composerMode === 'forward' && selectedThread
                    ? `Fwd: ${selectedThread.subject}`
                    : composerMode === 'reply' || composerMode === 'reply-all'
                    ? `Re: ${selectedThread?.subject || ''}`
                    : ''
                }
                onSend={handleComposerSend}
                onCancel={handleComposerCancel}
                userEmail={userEmail}
                userLanguage={userLanguage}
              />
            </div>
          ) : !selectedThread ? (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              <div className="text-center">
                <Mail className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select an email to view or compose a new message</p>
              </div>
            </div>
          ) : (
            <>
              {/* Email Header */}
              <div className="p-6 border-b border-slate-800">
                <h1 className="text-2xl font-bold text-white mb-4">{selectedThread.subject}</h1>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <span>{selectedThread.participants.length} participants</span>
                    <span>•</span>
                    <span>
                      {selectedThread.participants.map(p => p.language.toUpperCase()).join(', ')}
                    </span>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleReply}
                      variant="outline"
                      size="sm"
                      className="border-slate-700 text-slate-300"
                    >
                      <ReplyIcon className="w-4 h-4 mr-2" />
                      Reply
                    </Button>
                    <Button
                      onClick={handleReplyAll}
                      variant="outline"
                      size="sm"
                      className="border-slate-700 text-slate-300"
                    >
                      <ReplyAll className="w-4 h-4 mr-2" />
                      Reply All
                    </Button>
                    <Button
                      onClick={handleForward}
                      variant="outline"
                      size="sm"
                      className="border-slate-700 text-slate-300"
                    >
                      <Forward className="w-4 h-4 mr-2" />
                      Forward
                    </Button>
                  </div>
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
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
