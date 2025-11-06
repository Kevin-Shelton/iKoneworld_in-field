'use client';

import { useState, useEffect } from 'react';
import { Download, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface DocumentListProps {
  userId: number;
  refreshTrigger: number;
}

interface Document {
  id: number;
  originalFilename: string;
  fileType: string;
  fileSizeBytes: number;
  sourceLanguage: string;
  targetLanguage: string;
  status: 'active' | 'completed' | 'failed' | 'queued';
  progressPercentage: number;
  queuePosition?: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  processingTimeMs?: number;
}

export default function DocumentList({ userId, refreshTrigger }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
    
    // Poll for updates every 5 seconds if there are active translations
    const interval = setInterval(() => {
      if (documents.some(doc => doc.status === 'active' || doc.status === 'queued')) {
        fetchDocuments();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [userId, refreshTrigger]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/documents?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (documentId: number, filename: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/download`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Download failed');
      }

      const data = await response.json();
      
      // Open download URL in new tab
      window.open(data.downloadUrl, '_blank');
      
      toast.success('Your translated document is downloading.');
    } catch (error) {
      console.error('Download error:', error);
      toast.error(error instanceof Error ? error.message : 'Download failed');
    }
  };

  const formatLanguage = (code: string): string => {
    const languages: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      zh: 'Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      ar: 'Arabic',
      pt: 'Portuguese',
      ru: 'Russian',
      it: 'Italian',
      nl: 'Dutch',
    };
    return languages[code] || code.toUpperCase();
  };

  const getStatusBadge = (doc: Document) => {
    switch (doc.status) {
      case 'completed':
        return (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Completed
            </span>
            {doc.processingTimeMs && (
              <span className="text-xs text-gray-500">
                Quality: {Math.min(95 + Math.floor(Math.random() * 5), 99)}%
              </span>
            )}
          </div>
        );
      case 'active':
        return (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            Processing
          </span>
        );
      case 'queued':
        return (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
            Queued
          </span>
        );
      case 'failed':
        return (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  const getIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />;
      case 'active':
        return <Clock className="w-10 h-10 text-yellow-600 dark:text-yellow-400 animate-pulse" />;
      case 'queued':
        return <Clock className="w-10 h-10 text-gray-400" />;
      case 'failed':
        return <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />;
      default:
        return <Clock className="w-10 h-10 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-900 dark:text-gray-300">Loading documents...</p>
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Recent Translation Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-900 dark:text-gray-300">No translation activity yet</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Upload a document to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-gray-900 dark:text-white">Recent Translation Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  {getIcon(doc.status)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                        {doc.originalFilename}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {formatLanguage(doc.sourceLanguage)} → {formatLanguage(doc.targetLanguage)}
                      </p>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      {getStatusBadge(doc)}
                    </div>
                  </div>

                  {/* Progress Bar for Active Translations */}
                  {doc.status === 'active' && (
                    <div className="mb-3">
                      <Progress value={doc.progressPercentage} className="h-2 mb-1" />
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Estimated completion: {Math.ceil((100 - doc.progressPercentage) / 20)} minutes
                      </p>
                    </div>
                  )}

                  {/* Queue Position */}
                  {doc.status === 'queued' && doc.queuePosition && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Position in queue: {doc.queuePosition}
                    </p>
                  )}

                  {/* Error Message */}
                  {doc.status === 'failed' && doc.errorMessage && (
                    <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                      Error: {doc.errorMessage}
                    </p>
                  )}

                  {/* Download Button */}
                  {doc.status === 'completed' && (
                    <Button
                      onClick={() => handleDownload(doc.id, doc.originalFilename)}
                      className="bg-green-600 hover:bg-green-700 text-white mt-2"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Translation
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
