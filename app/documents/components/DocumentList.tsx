'use client';

import { useState, useEffect } from 'react';
import { Download, Trash2, FileText, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';
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
  status: 'active' | 'completed' | 'failed';
  progressPercentage: number;
  queuePosition?: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export default function DocumentList({ userId, refreshTrigger }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
    
    // Poll for updates every 5 seconds if there are active translations
    const interval = setInterval(() => {
      if (documents.some(doc => doc.status === 'active')) {
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

  const handleDelete = async (documentId: number) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      toast.success('The document has been removed.');

      fetchDocuments();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </span>
        );
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            <Loader className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
            <Clock className="w-3 h-3 mr-1" />
            Queued
          </span>
        );
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-black dark:text-gray-300">Loading documents...</p>
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-black dark:text-white">Recent Translations</CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-black dark:text-gray-300">No documents yet</p>
          <p className="text-sm text-black dark:text-gray-400">Upload a document to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-black dark:text-white">Recent Translations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start space-x-3 flex-1">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-black dark:text-white truncate">
                      {doc.originalFilename}
                    </h3>
                    <p className="text-xs text-black dark:text-gray-400 mt-1">
                      {doc.sourceLanguage.toUpperCase()} → {doc.targetLanguage.toUpperCase()} • {formatBytes(doc.fileSizeBytes)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(doc.status)}
                </div>
              </div>

              {/* Progress Bar for Active Translations */}
              {doc.status === 'active' && (
                <div className="mb-2">
                  <Progress value={doc.progressPercentage} className="h-2" />
                  <p className="text-xs text-black dark:text-gray-400 mt-1">
                    {doc.progressPercentage}% complete
                    {doc.queuePosition && ` • Position in queue: ${doc.queuePosition}`}
                  </p>
                </div>
              )}

              {/* Error Message */}
              {doc.status === 'failed' && doc.errorMessage && (
                <div className="mb-2">
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Error: {doc.errorMessage}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-black dark:text-gray-400">
                  {formatDate(doc.createdAt)}
                </p>
                <div className="flex items-center space-x-2">
                  {doc.status === 'completed' && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleDownload(doc.id, doc.originalFilename)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
