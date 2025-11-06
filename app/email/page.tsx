'use client';

import { useEffect, useState, useRef } from 'react';
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
  Plus,
  Trash2,
  Archive,
  RotateCcw,
  Check,
  CheckCheck,
  Search,
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { EmailComposer } from '@/components/EmailComposer';
import { toast } from 'sonner';

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
  is_deleted?: boolean;
  folder?: string;
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
  is_read?: boolean;
  is_deleted?: boolean;
  is_archived?: boolean;
}

type ComposerMode = 'compose' | 'reply' | 'reply-all' | 'forward' | null;
type FolderType = 'inbox' | 'sent' | 'drafts' | 'trash' | 'archive';

export default function EmailInboxPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<FolderType>('inbox');
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const [composerMode, setComposerMode] = useState<ComposerMode>(null);
  const [composerLanguage, setComposerLanguage] = useState('en');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [translationStatus, setTranslationStatus] = useState<Record<string, string[]>>({});
  const [drafts, setDrafts] = useState<any[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null);
  const [draftContent, setDraftContent] = useState({ subject: '', content: '', recipients: [] });
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [folderCounts, setFolderCounts] = useState<Record<FolderType, number>>({inbox: 0, sent: 0, drafts: 0, trash: 0, archive: 0});
  const [threadMessageCounts, setThreadMessageCounts] = useState<Record<string, number>>({});
  
  // Auto-refresh interval
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const draftSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const userLanguage = user?.user_metadata?.language || 'en';
  const userEmail = user?.email || '';

  useEffect(() => {
    loadThreads();
    loadUnreadCounts();
    loadFolderCounts();
    loadThreadMessageCounts();
    
    // Set up auto-refresh every 10 seconds
    refreshIntervalRef.current = setInterval(() => {
      loadThreads(true); // Silent refresh
      loadUnreadCounts();
      loadFolderCounts();
      loadThreadMessageCounts();
    }, 10000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [selectedFolder]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      // Ignore if typing in input/textarea (except Escape)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key !== 'Escape') return;
      }

      switch(e.key.toLowerCase()) {
        case 'c':
          if (!composerMode) {
            handleComposeNew();
          }
          break;
        case 'r':
          if (selectedThread && !composerMode) {
            handleReply();
          }
          break;
        case 'a':
          if (selectedThread && !composerMode) {
            handleReplyAll();
          }
          break;
        case 'f':
          if (selectedThread && !composerMode) {
            handleForward();
          }
          break;
        case 'delete':
        case 'backspace':
          if (selectedThread && !composerMode && e.target === document.body) {
            e.preventDefault();
            handleDeleteThread();
          }
          break;
        case 'j':
          if (!composerMode) {
            e.preventDefault();
            selectNextThread();
          }
          break;
        case 'k':
          if (!composerMode) {
            e.preventDefault();
            selectPreviousThread();
          }
          break;
        case 'escape':
          if (composerMode) {
            handleComposerCancel();
          }
          break;
        case '/':
          e.preventDefault();
          document.getElementById('email-search')?.focus();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedThread, composerMode, threads]);

  async function loadThreads(silent = false) {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      let query = supabase
        .from('email_threads')
        .select('*')
        .order('last_message_at', { ascending: false });

      // Filter by folder
      if (selectedFolder === 'trash') {
        query = query.eq('is_deleted', true);
      } else {
        query = query.eq('is_deleted', false);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Further filter by folder type
      let filteredData = data || [];
      
      if (selectedFolder === 'sent') {
        // Get threads where user has sent messages
        const threadIds = new Set<string>();
        const { data: sentMessages } = await supabase
          .from('email_messages')
          .select('thread_id')
          .eq('sender_email', userEmail)
          .eq('is_outbound', true)
          .eq('is_deleted', false);
        
        sentMessages?.forEach((msg: any) => threadIds.add(msg.thread_id));
        filteredData = filteredData.filter((t: EmailThread) => threadIds.has(t.id));
      } else if (selectedFolder === 'inbox') {
        // Show threads with inbound messages
        filteredData = filteredData.filter((t: EmailThread) => !t.folder || t.folder === 'inbox');
      }

      setThreads(filteredData);
      
      // Auto-select first thread if not composing
      if (filteredData && filteredData.length > 0 && !composerMode && !silent) {
        selectThread(filteredData[0]);
      }
    } catch (err) {
      console.error('Error loading threads:', err);
      if (!silent) {
        setError('Failed to load email threads');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  async function loadUnreadCounts() {
    try {
      // Get all unread messages grouped by thread
      const { data: unreadMessages } = await supabase
        .from('email_messages')
        .select('thread_id, id')
        .eq('is_read', false)
        .eq('is_deleted', false)
        .eq('is_outbound', false); // Only count inbound messages as unread

      const counts: Record<string, number> = {};
      unreadMessages?.forEach((msg: any) => {
        counts[msg.thread_id] = (counts[msg.thread_id] || 0) + 1;
      });

      setUnreadCounts(counts);
    } catch (err) {
      console.error('Error loading unread counts:', err);
    }
  }

  async function loadFolderCounts() {
    try {
      // Count threads in each folder
      const { data: allThreads } = await supabase
        .from('email_threads')
        .select('id, is_deleted, folder');

      const { data: allMessages } = await supabase
        .from('email_messages')
        .select('thread_id, is_outbound, is_deleted, sender_email');

      const sentThreadIds = new Set();
      allMessages?.forEach((msg: any) => {
        if (msg.is_outbound && !msg.is_deleted && msg.sender_email === userEmail) {
          sentThreadIds.add(msg.thread_id);
        }
      });

      const counts: Record<FolderType, number> = {
        inbox: 0,
        sent: 0,
        drafts: 0,
        trash: 0,
        archive: 0,
      };

      allThreads?.forEach((thread: any) => {
        if (thread.is_deleted) {
          counts.trash++;
        } else if (sentThreadIds.has(thread.id)) {
          counts.sent++;
        } else {
          counts.inbox++;
        }
      });

      // Count drafts separately
      const { data: draftsList } = await supabase
        .from('email_drafts')
        .select('id')
        .eq('user_email', userEmail);
      
      counts.drafts = draftsList?.length || 0;

      setFolderCounts(counts);
    } catch (err) {
      console.error('Error loading folder counts:', err);
    }
  }

  async function loadThreadMessageCounts() {
    try {
      const { data: messages } = await supabase
        .from('email_messages')
        .select('thread_id')
        .eq('is_deleted', false);

      const counts: Record<string, number> = {};
      messages?.forEach((msg: any) => {
        counts[msg.thread_id] = (counts[msg.thread_id] || 0) + 1;
      });

      setThreadMessageCounts(counts);
    } catch (err) {
      console.error('Error loading thread message counts:', err);
    }
  }

  async function selectThread(thread: EmailThread) {
    setSelectedThread(thread);
    setComposerMode(null);
    setLoadingMessages(true);
    setSelectedMessages(new Set());
    
    try {
      let query = supabase
        .from('email_messages')
        .select('*')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true });

      // Filter deleted messages unless in trash
      if (selectedFolder !== 'trash') {
        query = query.eq('is_deleted', false);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setMessages(data || []);
      
      // Mark unread messages as read
      const unreadIds = (data || [])
        .filter((m: EmailMessage) => !m.is_read && !m.is_outbound)
        .map((m: EmailMessage) => m.id);
      
      if (unreadIds.length > 0) {
        await supabase
          .from('email_messages')
          .update({ is_read: true })
          .in('id', unreadIds);
      }
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
    setComposerLanguage(userLanguage);
  }

  function handleReply() {
    if (!selectedThread || !messages.length) return;
    
    setComposerMode('reply');
    setComposerLanguage(userLanguage);
  }

  function handleReplyAll() {
    if (!selectedThread) return;
    setComposerMode('reply-all');
    setComposerLanguage(userLanguage);
  }

  function handleForward() {
    if (!selectedThread) return;
    setComposerMode('forward');
    setComposerLanguage(userLanguage);
  }

  async function handleComposerSend(recipientLanguages: string[]) {
    setComposerMode(null);
    
    // Show translation status
    if (recipientLanguages.length > 0) {
      const uniqueLangs = [...new Set(recipientLanguages)];
      toast.success(`Message translated to: ${uniqueLangs.join(', ').toUpperCase()}`, {
        icon: <CheckCheck className="w-4 h-4 text-green-500" />,
        duration: 5000,
      });
    }
    
    // Wait a moment for the database to update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await loadThreads();
    await loadFolderCounts();
    
    // Refresh messages for the currently selected thread
    if (selectedThread) {
      selectThread(selectedThread);
    }
  }

  function handleComposerCancel() {
    setComposerMode(null);
  }

  function selectNextThread() {
    if (!selectedThread || threads.length === 0) return;
    const currentIndex = threads.findIndex((t: EmailThread) => t.id === selectedThread.id);
    if (currentIndex < threads.length - 1) {
      selectThread(threads[currentIndex + 1]);
    }
  }

  function selectPreviousThread() {
    if (!selectedThread || threads.length === 0) return;
    const currentIndex = threads.findIndex((t: EmailThread) => t.id === selectedThread.id);
    if (currentIndex > 0) {
      selectThread(threads[currentIndex - 1]);
    }
  }

  async function handleDeleteThread() {
    if (!selectedThread) return;

    try {
      if (selectedFolder === 'trash') {
        // Permanent delete
        if (!confirm('Permanently delete this conversation? This cannot be undone.')) {
          return;
        }
        
        await supabase
          .from('email_messages')
          .delete()
          .eq('thread_id', selectedThread.id);
        
        await supabase
          .from('email_threads')
          .delete()
          .eq('id', selectedThread.id);
        
        toast.success('Conversation permanently deleted');
      } else {
        // Move to trash (soft delete)
        await supabase
          .from('email_threads')
          .update({ 
            is_deleted: true,
            deleted_at: new Date().toISOString()
          })
          .eq('id', selectedThread.id);
        
        await supabase
          .from('email_messages')
          .update({ is_deleted: true })
          .eq('thread_id', selectedThread.id);
        
        toast.success('Moved to trash');
      }
      
      setSelectedThread(null);
      setMessages([]);
      loadThreads();
    } catch (err) {
      console.error('Error deleting thread:', err);
      toast.error('Failed to delete conversation');
    }
  }

  async function handleRestoreThread() {
    if (!selectedThread) return;

    try {
      await supabase
        .from('email_threads')
        .update({ 
          is_deleted: false,
          deleted_at: null
        })
        .eq('id', selectedThread.id);
      
      await supabase
        .from('email_messages')
        .update({ is_deleted: false })
        .eq('thread_id', selectedThread.id);
      
      toast.success('Restored to inbox');
      setSelectedThread(null);
      setMessages([]);
      loadThreads();
    } catch (err) {
      console.error('Error restoring thread:', err);
      toast.error('Failed to restore conversation');
    }
  }

  async function handleArchiveThread() {
    if (!selectedThread) return;

    try {
      await supabase
        .from('email_messages')
        .update({ is_archived: true })
        .eq('thread_id', selectedThread.id);
      
      toast.success('Archived');
      setSelectedThread(null);
      setMessages([]);
      loadThreads();
    } catch (err) {
      console.error('Error archiving thread:', err);
      toast.error('Failed to archive conversation');
    }
  }

  function toggleMessageSelection(messageId: string) {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }

  async function handleBulkDelete() {
    if (selectedMessages.size === 0) return;

    try {
      await supabase
        .from('email_messages')
        .update({ is_deleted: true })
        .in('id', Array.from(selectedMessages));
      
      toast.success(`${selectedMessages.size} messages moved to trash`);
      setSelectedMessages(new Set());
      if (selectedThread) {
        selectThread(selectedThread);
      }
    } catch (err) {
      console.error('Error bulk deleting:', err);
      toast.error('Failed to delete messages');
    }
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
          .filter((p: any) => p.email !== userEmail)
          .map((p: any) => ({
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

  const getTotalUnreadCount = () => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  };

  const folders = [
    { id: 'inbox' as FolderType, label: 'Inbox', icon: Inbox, count: folderCounts.inbox, unread: getTotalUnreadCount() },
    { id: 'sent' as FolderType, label: 'Sent', icon: SendIcon, count: folderCounts.sent },
    { id: 'drafts' as FolderType, label: 'Drafts', icon: Mail, count: folderCounts.drafts },
    { id: 'archive' as FolderType, label: 'Archive', icon: Archive, count: folderCounts.archive },
    { id: 'trash' as FolderType, label: 'Trash', icon: Trash2, count: folderCounts.trash },
  ];

  const filteredThreads = threads.filter(thread => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      thread.subject.toLowerCase().includes(query) ||
      thread.participants.some(p => 
        p.email.toLowerCase().includes(query) || 
        p.name.toLowerCase().includes(query)
      )
    );
  });

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
                  <div className="flex items-center gap-1">
                    {folder.id === 'inbox' && folder.unread && folder.unread > 0 && (
                      <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">
                        {folder.unread}
                      </span>
                    )}
                    {folder.count > 0 && folder.id !== 'inbox' && (
                      <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">
                        {folder.count}
                      </span>
                    )}
                  </div>
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

        {/* Middle Panel - Thread List */}
        <div className="w-96 bg-slate-900 border-r border-slate-800 flex flex-col">
          {/* Search Bar */}
          <div className="p-4 border-b border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="email-search"
                type="text"
                placeholder="Search emails... (Press / to focus)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : error ? (
              <div className="p-4 text-center text-red-400">{error}</div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-4 text-center text-slate-400">
                {searchQuery ? 'No matching emails' : 'No emails'}
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const participant = thread.participants.find((p: any) => p.email !== userEmail) || thread.participants[0];
                const hasUnread = (unreadCounts[thread.id] || 0) > 0;
                const messageCount = threadMessageCounts[thread.id] || 0;
                
                return (
                  <button
                    key={thread.id}
                    onClick={() => selectThread(thread)}
                    className={`w-full text-left p-4 border-b border-slate-800 hover:bg-slate-800 transition-colors ${
                      selectedThread?.id === thread.id ? 'bg-slate-800' : ''
                    } ${hasUnread ? 'bg-slate-800/50' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {hasUnread && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                        )}
                        <span className={`text-sm ${hasUnread ? 'font-bold text-white' : 'text-slate-300'} truncate`}>
                          {participant.name}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 flex-shrink-0">
                          {participant.language.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                        {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className={`text-sm mb-1 ${hasUnread ? 'font-semibold text-white' : 'text-slate-400'} truncate`}>
                      {thread.subject}
                    </div>
                    {messageCount > 0 && (
                      <div className="text-xs text-slate-500">
                        {messageCount} message{messageCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel - Message View or Composer */}
        <div className="flex-1 flex flex-col bg-slate-950">
          {composerMode ? (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  {composerMode === 'compose' && 'New Message'}
                  {composerMode === 'reply' && 'Reply'}
                  {composerMode === 'reply-all' && 'Reply All'}
                  {composerMode === 'forward' && 'Forward'}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">Compose in</span>
                  <select
                    value={composerLanguage}
                    onChange={(e) => {
                      setComposerLanguage(e.target.value);
                      toast.info(`Composing in ${e.target.value.toUpperCase()}`);
                    }}
                    className="px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-medium rounded transition-colors outline-none cursor-pointer hover:bg-green-500/30"
                  >
                    <option value="en" className="bg-slate-800">EN</option>
                    <option value="es" className="bg-slate-800">ES</option>
                    <option value="fr" className="bg-slate-800">FR</option>
                    <option value="de" className="bg-slate-800">DE</option>
                    <option value="ja" className="bg-slate-800">JA</option>
                    <option value="zh" className="bg-slate-800">ZH</option>
                    <option value="ko" className="bg-slate-800">KO</option>
                    <option value="pt" className="bg-slate-800">PT</option>
                    <option value="it" className="bg-slate-800">IT</option>
                    <option value="ru" className="bg-slate-800">RU</option>
                  </select>
                  <span className="text-sm text-slate-400">• Will auto-translate to each recipient's language</span>
                </div>
              </div>
              <EmailComposer
                mode={composerMode}
                threadId={selectedThread?.id}
                initialRecipients={getComposerRecipients()}
                initialSubject={
                  composerMode === 'forward'
                    ? `Fwd: ${selectedThread?.subject || ''}`
                    : composerMode === 'reply' || composerMode === 'reply-all'
                    ? `Re: ${selectedThread?.subject || ''}`
                    : ''
                }
                onSend={(langs) => handleComposerSend(langs)}
                onCancel={handleComposerCancel}
                userEmail={userEmail}
                userLanguage={composerLanguage}
              />
            </div>
          ) : selectedThread ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-slate-800">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-white mb-1">
                      {selectedThread.subject}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <span>{selectedThread.participants.length} participants</span>
                      <span>•</span>
                      {selectedThread.participants.map(p => (
                        <span key={p.email} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {p.language.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedFolder === 'trash' ? (
                      <Button
                        onClick={handleRestoreThread}
                        variant="outline"
                        size="sm"
                        className="border-green-500/20 text-green-400 hover:bg-green-500/10"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Restore
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={handleReply}
                          variant="outline"
                          size="sm"
                          className="border-blue-500/20 text-blue-400 hover:bg-blue-500/10"
                        >
                          <ReplyIcon className="w-4 h-4 mr-2" />
                          Reply
                        </Button>
                        <Button
                          onClick={handleReplyAll}
                          variant="outline"
                          size="sm"
                          className="border-blue-500/20 text-blue-400 hover:bg-blue-500/10"
                        >
                          <ReplyAll className="w-4 h-4 mr-2" />
                          Reply All
                        </Button>
                        <Button
                          onClick={handleForward}
                          variant="outline"
                          size="sm"
                          className="border-blue-500/20 text-blue-400 hover:bg-blue-500/10"
                        >
                          <Forward className="w-4 h-4 mr-2" />
                          Forward
                        </Button>
                        <Button
                          onClick={handleArchiveThread}
                          variant="outline"
                          size="sm"
                          className="border-purple-500/20 text-purple-400 hover:bg-purple-500/10"
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      onClick={handleDeleteThread}
                      variant="outline"
                      size="sm"
                      className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {selectedMessages.size > 0 && (
                  <div className="mt-2 flex items-center gap-2 p-2 bg-blue-500/10 rounded-lg">
                    <span className="text-sm text-blue-400">
                      {selectedMessages.size} selected
                    </span>
                    <Button
                      onClick={handleBulkDelete}
                      size="sm"
                      variant="outline"
                      className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete Selected
                    </Button>
                    <Button
                      onClick={() => setSelectedMessages(new Set())}
                      size="sm"
                      variant="ghost"
                      className="text-slate-400"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-slate-400">No messages</div>
                ) : (
                  messages.map((message) => {
                    const content = getMessageContent(message);
                    const isTranslated = message.original_language !== userLanguage && 
                                       message.translations[userLanguage];
                    const isSelected = selectedMessages.has(message.id);
                    
                    return (
                      <Card 
                        key={message.id} 
                        className={`p-4 bg-slate-900 border-slate-800 ${
                          isSelected ? 'ring-2 ring-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleMessageSelection(message.id)}
                              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">
                                  {message.sender_name}
                                </span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                  {message.sender_email}
                                </span>
                                {message.is_outbound && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-600 text-white">
                                    SENT
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                {new Date(message.created_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isTranslated && (
                              <span className="text-xs px-2 py-1 rounded bg-green-600 text-white flex items-center gap-1">
                                <Languages className="w-3 h-3" />
                                {message.original_language.toUpperCase()} → {userLanguage.toUpperCase()}
                              </span>
                            )}
                            {isTranslated && (
                              <Button
                                onClick={() => toggleOriginal(message.id)}
                                variant="ghost"
                                size="sm"
                                className="text-slate-400 hover:text-white"
                              >
                                {showOriginal[message.id] ? (
                                  <>
                                    <Eye className="w-4 h-4 mr-1" />
                                    Show Translation
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="w-4 h-4 mr-1" />
                                    Show Original
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="text-slate-200 whitespace-pre-wrap">
                          {content}
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Mail className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
