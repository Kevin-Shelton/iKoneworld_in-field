'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  X, 
  Download, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Users,
  FileText,
  Activity,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

interface QueueDocument {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  originalFilename: string;
  fileType: string;
  fileSizeBytes: number;
  sourceLanguage: string;
  targetLanguage: string;
  status: 'queued' | 'active' | 'completed' | 'failed';
  progressPercentage: number;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
}

interface QueueStats {
  total: number;
  queued: number;
  active: number;
  completed: number;
  failed: number;
}

export default function AdminQueuePage() {
  const [documents, setDocuments] = useState<QueueDocument[]>([]);
  const [stats, setStats] = useState<QueueStats>({
    total: 0,
    queued: 0,
    active: 0,
    completed: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'queued' | 'active' | 'completed' | 'failed'>('all');

  useEffect(() => {
    fetchDocuments();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/admin/documents');
      
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      setDocuments(data.documents || []);
      setStats(data.stats || {});
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to fetch queue data');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (documentId: number) => {
    try {
      toast.info('Retrying translation...');
      
      const response = await fetch(`/api/documents/${documentId}/translate`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to retry translation');
      }
      
      toast.success('Translation restarted');
      fetchDocuments();
    } catch (error) {
      console.error('Retry error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to retry');
    }
  };

  const handleCancel = async (documentId: number) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel translation');
      }
      
      toast.success('Translation cancelled');
      fetchDocuments();
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to cancel');
    }
  };

  const handleDownload = async (documentId: number) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/download`);
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const data = await response.json();
      window.open(data.downloadUrl, '_blank');
      toast.success('Download started');
    } catch (error) {
      console.error('Download error:', error);
      toast.error(error instanceof Error ? error.message : 'Download failed');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>;
      case 'active':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Processing</Badge>;
      case 'queued':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Queued</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'active':
        return <Activity className="w-5 h-5 text-blue-600 animate-pulse" />;
      case 'queued':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };

  const filteredDocuments = filter === 'all' 
    ? documents 
    : documents.filter(doc => doc.status === filter);

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Translation Queue Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Monitor and manage all document translations</p>
        </div>
        <Button onClick={fetchDocuments} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFilter('all')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
              <FileText className="w-10 h-10 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFilter('queued')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Queued</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.queued}</p>
              </div>
              <Clock className="w-10 h-10 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFilter('active')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Processing</p>
                <p className="text-3xl font-bold text-blue-600">{stats.active}</p>
              </div>
              <Activity className="w-10 h-10 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFilter('completed')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFilter('failed')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
                <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Info */}
      {filter !== 'all' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Showing:</span>
          {getStatusBadge(filter)}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setFilter('all')}
            className="text-xs"
          >
            Clear filter
          </Button>
        </div>
      )}

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Documents ({filteredDocuments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No documents found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Status Icon */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      {getStatusIcon(doc.status)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                            {doc.originalFilename}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {doc.userName} ({doc.userEmail})
                            </span>
                            <span>•</span>
                            <span>{formatFileSize(doc.fileSizeBytes)}</span>
                            <span>•</span>
                            <span>
                              {formatLanguage(doc.sourceLanguage)} → {formatLanguage(doc.targetLanguage)}
                            </span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-4">
                          {getStatusBadge(doc.status)}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {doc.status === 'active' && (
                        <div className="mb-3">
                          <Progress value={doc.progressPercentage} className="h-2 mb-1" />
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Progress: {doc.progressPercentage}%
                          </p>
                        </div>
                      )}

                      {/* Error Message */}
                      {doc.status === 'failed' && doc.errorMessage && (
                        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                          <p className="text-sm text-red-600 dark:text-red-400">
                            <strong>Error:</strong> {doc.errorMessage}
                          </p>
                        </div>
                      )}

                      {/* Timestamps */}
                      <div className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                        <span>Created: {formatDate(doc.createdAt)}</span>
                        {doc.startedAt && (
                          <>
                            <span className="mx-2">•</span>
                            <span>Started: {formatDate(doc.startedAt)}</span>
                          </>
                        )}
                        {doc.endedAt && (
                          <>
                            <span className="mx-2">•</span>
                            <span>Ended: {formatDate(doc.endedAt)}</span>
                          </>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {doc.status === 'completed' && (
                          <Button
                            onClick={() => handleDownload(doc.id)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        )}
                        
                        {(doc.status === 'failed' || doc.status === 'queued') && (
                          <Button
                            onClick={() => handleRetry(doc.id)}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Retry
                          </Button>
                        )}
                        
                        {(doc.status === 'active' || doc.status === 'queued') && (
                          <Button
                            onClick={() => handleCancel(doc.id)}
                            size="sm"
                            variant="outline"
                            className="border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
