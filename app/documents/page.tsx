'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import DocumentStats from './components/DocumentStats';
import DocumentUpload from './components/DocumentUpload';
import DocumentList from './components/DocumentList';

export default function DocumentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [dbUserId, setDbUserId] = useState<number | null>(null);
  const [enterpriseId, setEnterpriseId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [optimisticDocuments, setOptimisticDocuments] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    // Sync user and get database ID
    const syncUser = async () => {
      try {
        const response = await fetch('/api/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            email: user.email,
            loginMethod: 'manus',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to sync user');
        }

        const data = await response.json();
        setDbUserId(data.userId);
        
        // Get enterprise ID from user data
        if (data.user?.enterprise_id) {
          setEnterpriseId(data.user.enterprise_id);
        }
      } catch (error) {
        console.error('Error syncing user:', error);
      }
    };

    syncUser();
  }, [user, router]);

  const handleUploadComplete = () => {
    // Trigger refresh of document list and stats
    setRefreshTrigger(prev => prev + 1);
  };
  
  const handleUploadStart = (fileInfo: any) => {
    // Add optimistic document to show immediately
    const optimisticDoc = {
      id: `temp-${Date.now()}`,
      originalFilename: fileInfo.filename,
      fileType: fileInfo.fileType,
      fileSizeBytes: fileInfo.fileSize,
      sourceLanguage: fileInfo.sourceLanguage,
      targetLanguage: fileInfo.targetLanguage,
      status: 'queued',
      progressPercentage: 0,
      createdAt: new Date().toISOString(),
      method: fileInfo.method,
      estimatedTimeSeconds: fileInfo.estimatedTime,
      isOptimistic: true,
    };
    setOptimisticDocuments(prev => [optimisticDoc, ...prev]);
  };
  
  const clearOptimisticDocuments = () => {
    setOptimisticDocuments([]);
  };

  if (!user || !dbUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-black dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navigation />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-700 dark:text-white mb-2">
            Enterprise Document Translation Platform
          </h1>
        </div>

        {/* Stats Cards */}
        <DocumentStats userId={dbUserId} refreshTrigger={refreshTrigger} />

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Upload Area - Left Column */}
          <div className="lg:col-span-1">
            <DocumentUpload
              userId={dbUserId}
              enterpriseId={enterpriseId ?? undefined}
              onUploadComplete={handleUploadComplete}
              onUploadStart={handleUploadStart}
            />
          </div>

          {/* Document List - Right Column */}
          <div className="lg:col-span-2">
            <DocumentList 
              userId={dbUserId} 
              refreshTrigger={refreshTrigger}
              optimisticDocuments={optimisticDocuments}
              onClearOptimistic={clearOptimisticDocuments}
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
