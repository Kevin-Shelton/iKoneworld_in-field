'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { getAudioUrl } from '@/lib/hooks/useAudioUrl';
import { StartDemoChat } from '@/components/StartDemoChat';
import { Mail } from 'lucide-react';

type Conversation = {
  id: number;
  userId: number;
  enterprise_id?: string;
  customer_id?: string;
  language1: string;
  language2: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  audio_url?: string;
  audio_file_path?: string;  // Relative file path for client-side URL generation
  audio_duration_seconds?: number;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    is_demo?: boolean;
    conversation_type?: string;
    employee_name?: string;
    session_id?: string;
  };
};

type ConversationMessage = {
  id: number;
  conversationId: number;
  speaker: 'user' | 'guest';
  original_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  audio_url?: string;
  audio_file_path?: string;  // Relative file path for client-side URL generation
  audio_duration_seconds?: number;
  confidence_score?: number;
  timestamp: string;
};

function DashboardContent() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbUserId, setDbUserId] = useState<number | null>(null);
  const [dbUserName, setDbUserName] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const conversationsPerPage = 10;

  useEffect(() => {
    if (user) {
      // Sync user to database first and get database user ID
      syncUser();
    }
  }, [user]);

  const syncUser = async () => {
    try {
      const response = await fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          email: user?.email,
          name: (user as any)?.user_metadata?.name || user?.email?.split('@')[0],
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const userId = data.userId;
        const userName = data.userName || user?.email || 'Employee';
        setDbUserId(userId);
        setDbUserName(userName);
        // Now fetch conversations with the database user ID
        fetchConversations(userId);
      }
    } catch (err) {
      console.error('Error syncing user:', err);
    }
  };

  const fetchConversations = async (userId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/conversations?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error('Error fetching conversations:', err);
      toast.error('Failed to load conversation history');
    } finally {
      setLoading(false);
    }
  };

  const fetchConversationMessages = async (conversationId: number) => {
    try {
      setLoadingMessages(true);
      const response = await fetch(`/api/conversations/${conversationId}/messages`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      setConversationMessages(data.messages || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
      toast.error('Failed to load conversation messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleViewConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    fetchConversationMessages(conv.id);
  };

  const handleCloseModal = () => {
    setSelectedConversation(null);
    setConversationMessages([]);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (err) {
      console.error('Error signing out:', err);
      toast.error('Failed to sign out');
    }
  };

  // Group conversations by date
  const groupedConversations = conversations.reduce((groups, conv) => {
    const date = new Date(conv.startedAt).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(conv);
    return groups;
  }, {} as Record<string, Conversation[]>);

  // Apply filters
  const filteredConversations = conversations.filter((conv) => {
    // Filter by employee
    if (filterEmployee !== "all") {
      const employeeName = conv.metadata?.employee_name || 'Unknown Employee';
      if (employeeName !== filterEmployee) {
        return false;
      }
    }
    // Filter by type
    if (filterType !== "all") {
      const isChat = conv.metadata?.is_demo || conv.metadata?.conversation_type === "demo" || conv.metadata?.conversation_type === "chat";
      if (filterType === "chat" && !isChat) return false;
      if (filterType === "translation" && isChat) return false;
    }
    // Filter by date range
    if (filterDateFrom) {
      const convDate = new Date(conv.startedAt);
      const fromDate = new Date(filterDateFrom + 'T00:00:00');
      // Compare dates only (ignore time)
      const convDateOnly = new Date(convDate.getFullYear(), convDate.getMonth(), convDate.getDate());
      const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
      if (convDateOnly < fromDateOnly) return false;
    }
    if (filterDateTo) {
      const convDate = new Date(conv.startedAt);
      const toDate = new Date(filterDateTo + 'T23:59:59');
      // Compare dates only (ignore time)
      const convDateOnly = new Date(convDate.getFullYear(), convDate.getMonth(), convDate.getDate());
      const toDateOnly = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
      if (convDateOnly > toDateOnly) return false;
    }
    return true;
  });

  // Get unique employees for filter dropdown
  const uniqueEmployees = Array.from(
    new Set(
      conversations
        .map((c) => c.metadata?.employee_name || 'Unknown Employee')
        .filter((name): name is string => !!name)
    )
  ).sort();

  // Debug logging
  console.log('Total conversations:', conversations.length);
  console.log('Unique employees:', uniqueEmployees);
  console.log('Filtered conversations:', filteredConversations.length);
  console.log('Sample conversation metadata:', conversations[0]?.metadata);

  // Pagination
  const indexOfLastConversation = currentPage * conversationsPerPage;
  const indexOfFirstConversation = indexOfLastConversation - conversationsPerPage;
  const currentConversations = filteredConversations.slice(indexOfFirstConversation, indexOfLastConversation);
  const totalPages = Math.ceil(filteredConversations.length / conversationsPerPage);

  const formatDuration = (startedAt: string, endedAt: string | null) => {
    if (!endedAt) return 'In progress';
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <Navigation />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Stats Cards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Today's Conversations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{conversations.filter(c => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return new Date(c.startedAt) >= today;
              }).length}</p>
              <p className="text-sm text-gray-600 mt-1">Conversations today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{conversations.filter(c => {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return new Date(c.startedAt) >= weekAgo;
              }).length}</p>
              <p className="text-sm text-gray-600 mt-1">Total conversations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600">{new Set(conversations.map(c => c.customer_id)).size}</p>
              <p className="text-sm text-gray-600 mt-1">Unique customers served</p>
            </CardContent>
          </Card>
        </div>

        {/* Start New Conversation Card */}
        <Card className="mb-8 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
          <CardHeader>
            <CardTitle className="text-white text-xl">Start New Conversation</CardTitle>
            <CardDescription className="text-gray-300">Begin a real-time translation session with a customer</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <button
              onClick={() => router.push('/select-language')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              In-Field
            </button>
            {dbUserId ? (
              <StartDemoChat userId={dbUserId} employeeName={dbUserName || user?.email || 'Employee'} />
            ) : (
              <button
                disabled
                className="bg-gray-400 text-white font-semibold py-2 px-6 rounded-lg cursor-not-allowed"
              >
                Loading...
              </button>
            )}
            <button
              onClick={() => router.push('/email')}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
          </CardContent>
        </Card>

        {/* Recent Conversations Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Conversations</CardTitle>
            <CardDescription>Your latest translation sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                <p>No conversations yet</p>
                <p className="text-sm mt-2">Start your first translation session to see it here</p>
              </div>
            ) : (
              <>
                {/* Filters */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                    <select
                      value={filterEmployee}
                      onChange={(e) => setFilterEmployee(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Employees</option>
                      {uniqueEmployees.map((emp) => (
                        <option key={emp} value={emp}>{emp}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Types</option>
                      <option value="chat">Chat</option>
                      <option value="translation">Translation</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Employee</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Languages</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Duration</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentConversations.map((conv) => (
                        <tr key={conv.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900">#{conv.id}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              (conv.metadata?.is_demo || conv.metadata?.conversation_type === 'demo' || conv.metadata?.conversation_type === 'chat') 
                                ? 'bg-purple-100 text-purple-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {(conv.metadata?.is_demo || conv.metadata?.conversation_type === 'demo' || conv.metadata?.conversation_type === 'chat') ? 'Chat' : 'Translation'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {conv.metadata?.employee_name || 'Unknown Employee'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {new Date(conv.startedAt + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {new Date(conv.startedAt + 'Z').toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <span className="font-medium">{conv.language1}</span> → <span className="font-medium">{conv.language2}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDuration(conv.startedAt, conv.endedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              conv.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {conv.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm space-x-2">
                            {/* Show Resume Chat button for active chat conversations */}
                            {conv.status === 'active' && (conv.metadata?.is_demo || conv.metadata?.conversation_type === 'demo' || conv.metadata?.conversation_type === 'chat') && (
                              <button
                                onClick={() => router.push(`/demo/${conv.metadata?.session_id || conv.id}`)}
                                className="text-green-600 hover:text-green-800 font-medium"
                              >
                                Resume Chat
                              </button>
                            )}
                            <button
                              onClick={() => handleViewConversation(conv)}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      Showing {indexOfFirstConversation + 1} to {Math.min(indexOfLastConversation, filteredConversations.length)} of {filteredConversations.length} conversations
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1 text-sm border rounded-md ${
                            currentPage === page
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
      
      {/* Footer */}
      <Footer />

      {/* Conversation Detail Modal */}
      {selectedConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={handleCloseModal}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Conversation #{selectedConversation.id}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date(selectedConversation.startedAt).toLocaleString()} • {selectedConversation.language1} ↔ {selectedConversation.language2}
                  </p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Conversation Audio Player */}
              {(selectedConversation.audio_file_path || selectedConversation.audio_url) && (() => {
                const audioUrl = selectedConversation.audio_file_path 
                  ? getAudioUrl(selectedConversation.audio_file_path)
                  : selectedConversation.audio_url;
                
                return audioUrl ? (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Full Conversation Recording</h3>
                    <audio controls className="w-full" key={audioUrl}>
                      <source src={audioUrl} type="audio/webm" />
                      Your browser does not support the audio element.
                    </audio>
                    {selectedConversation.audio_duration_seconds && (
                      <p className="text-xs text-gray-500 mt-2">
                        Duration: {Math.floor(selectedConversation.audio_duration_seconds / 60)}:{String(selectedConversation.audio_duration_seconds % 60).padStart(2, '0')}
                      </p>
                    )}
                  </div>
                ) : null;
              })()}

              {loadingMessages ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Loading messages...</p>
                </div>
              ) : conversationMessages.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  <p>No messages in this conversation</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conversationMessages.map((msg) => (
                    <div key={msg.id} className={`p-4 rounded-lg ${
                      msg.speaker === 'user' ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-green-50 border-l-4 border-green-500'
                    }`}>
                      <div className="mb-2">
                        <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
                          {msg.speaker === 'user' ? 'You' : 'Guest'} ({msg.source_language})
                        </p>
                        <p className="text-gray-900 font-medium">{msg.original_text}</p>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
                          Translation ({msg.target_language})
                        </p>
                        <p className="text-gray-700">{msg.translated_text}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                        {msg.confidence_score && ` • Confidence: ${Math.round(msg.confidence_score * 100)}%`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
