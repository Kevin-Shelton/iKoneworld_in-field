'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

type Conversation = {
  id: number;
  userId: number;
  enterprise_id: string;
  customer_id: string;
  user_language: string;
  guest_language: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function DashboardContent() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // Sync user to database first
      syncUser().then(() => {
        fetchConversations();
      });
    }
  }, [user]);

  const syncUser = async () => {
    try {
      await fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          email: user?.email,
          name: (user as any)?.user_metadata?.name || user?.email?.split('@')[0],
        }),
      });
    } catch (err) {
      console.error('Error syncing user:', err);
    }
  };

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/conversations?userId=${user?.id}`);
      
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

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      router.push('/');
    } catch (error) {
      toast.error('Error signing out');
      console.error('Sign out error:', error);
    }
  };

  const handleStartConversation = () => {
    router.push('/select-language');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Admin Panel Button */}
        {(user as any)?.role === 'admin' && (
          <div className="mb-6">
            <Button variant="outline" onClick={() => router.push('/admin/users')}>
              Admin Panel
            </Button>
          </div>
        )}
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Start New Conversation Card */}
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>Start New Conversation</CardTitle>
              <CardDescription>
                Begin a real-time translation session with a customer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleStartConversation} size="lg" className="w-full md:w-auto">
                Start Translation Session
              </Button>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Today's Conversations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{conversations.filter(c => {
                const today = new Date();
                const convDate = new Date(c.startedAt);
                return convDate.toDateString() === today.toDateString();
              }).length}</p>
              <p className="text-sm text-muted-foreground mt-1">{conversations.filter(c => {
                const today = new Date();
                const convDate = new Date(c.startedAt);
                return convDate.toDateString() === today.toDateString();
              }).length === 0 ? 'No conversations yet' : 'Conversations today'}</p>
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
              <p className="text-sm text-muted-foreground mt-1">Total conversations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600">{new Set(conversations.map(c => c.customer_id)).size}</p>
              <p className="text-sm text-muted-foreground mt-1">Unique customers served</p>
            </CardContent>
          </Card>

          {/* Recent Conversations */}
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>Recent Conversations</CardTitle>
              <CardDescription>Your latest translation sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No conversations yet</p>
                  <p className="text-sm mt-2">Start your first translation session to see it here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conversations.slice(0, 5).map((conv) => (
                    <div key={conv.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">Conversation #{conv.id}</p>
                        <p className="text-sm text-muted-foreground">
                          {conv.user_language} → {conv.guest_language}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(conv.startedAt).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          conv.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {conv.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      {/* Footer */}
      <Footer />
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
