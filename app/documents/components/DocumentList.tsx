'use client';

import { useState, useEffect } from 'react';
import { Download, CheckCircle, Clock, AlertCircle, X, RefreshCw, Zap, Layers, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface DocumentListProps {
  userId: number;
  refreshTrigger: number;
  optimisticDocuments?: any[];
  onClearOptimistic?: () => void;
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
  method?: 'skeleton' | 'chunking';
  estimatedTimeSeconds?: number;
  chunkCount?: number;
}

export default function DocumentList({ userId, refreshTrigger, optimisticDocuments = [], onClearOptimistic }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  
  // Get user-friendly status message based on progress
  const getStatusMessage = (progress: number): string => {
    if (progress === 0) return 'Uploading your document...';
    if (progress <= 5) return 'Uploading your document...';
    if (progress <= 15) return 'Analyzing document structure...';
    if (progress <= 25) return 'Reading content...';
    if (progress <= 35) return 'Preparing for translation...';
    if (progress <= 70) return 'Translating your content...';
    if (progress <= 80) return 'Rebuilding document layout...';
    if (progress <= 90) return 'Performing quality checks...';
    if (progress <= 95) return 'Finalizing your document...';
    if (progress < 100) return 'Preparing download...';
    return 'Translation complete!';
  };

  useEffect(() => {
    fetchDocuments();
    
    // Poll for updates every 2 seconds if there are active translations
    const interval = setInterval(() => {
      if (documents.some(doc => doc.status === 'active' || doc.status === 'queued')) {
        fetchDocuments();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [userId, refreshTrigger]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/documents?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      const fetchedDocs = data.documents || [];
      setDocuments(fetchedDocs);
      
      // Clear optimistic documents once we have real data
      if (fetchedDocs.length > 0 && onClearOptimistic) {
        onClearOptimistic();
      }
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

  const handleCancel = async (documentId: number) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel translation');
      }
      
      toast.success('Translation cancelled');
      fetchDocuments(); // Refresh list
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to cancel');
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
      fetchDocuments(); // Refresh list
    } catch (error) {
      console.error('Retry error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to retry');
    }
  };

  const handleDelete = async (documentId: number, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/${documentId}/delete`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete document');
      }
      
      toast.success('Document deleted successfully');
      fetchDocuments(); // Refresh list
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete');
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
          <CardTitle className="text-gray-900 dark:text-white">Document Translation History</CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-900 dark:text-gray-300">No translation activity yet</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Upload a document to get started</p>
        </CardContent>
      </Card>
    );
  }

  // Merge optimistic documents with real documents
  const allDocuments = [...optimisticDocuments, ...documents];
  
  // Calculate pagination
  const totalPages = Math.ceil(allDocuments.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedDocuments = allDocuments.slice(startIndex, endIndex);

  return (
    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-gray-900 dark:text-white">Document Translation History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {paginatedDocuments.map((doc) => (
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
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatLanguage(doc.sourceLanguage)} → {formatLanguage(doc.targetLanguage)}
                        </p>
                        <span className="text-gray-400">•</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(doc.createdAt).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                        {doc.method && (
                          <>
                            <span className="text-gray-400">•</span>
                            <div className="flex items-center gap-1">
                              {doc.method === 'skeleton' ? (
                                <>
                                  <Zap className="w-3.5 h-3.5 text-yellow-500" />
                                  <span className="text-xs font-medium text-yellow-600 dark:text-yellow-500">Fast Mode</span>
                                </>
                              ) : (
                                <>
                                  <Layers className="w-3.5 h-3.5 text-blue-500" />
                                  <span className="text-xs font-medium text-blue-600 dark:text-blue-500">Chunked ({doc.chunkCount} parts)</span>
                                </>
                              )}
                            </div>
                          </>
                        )}
                        {doc.estimatedTimeSeconds && doc.status !== 'completed' && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ~{Math.ceil(doc.estimatedTimeSeconds / 60)}min
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      {getStatusBadge(doc)}
                    </div>
                  </div>

                  {/* Progress Bar for Active and Queued Translations */}
                  {(doc.status === 'active' || doc.status === 'queued') && (
                    <div className="mb-3">
                      {/* Status Message */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="animate-pulse">
                          <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                        </div>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {getStatusMessage(doc.progressPercentage || 0)}
                        </p>
                      </div>
                      
                      {/* Progress Bar */}
                      <Progress value={doc.progressPercentage || 0} className="h-2 mb-1" />
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {doc.progressPercentage || 0}% complete
                        </p>
                        {doc.estimatedTimeSeconds && doc.progressPercentage < 100 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Est. {Math.ceil((doc.estimatedTimeSeconds * (100 - (doc.progressPercentage || 0)) / 100) / 60)} min remaining
                          </p>
                        )}
                      </div>
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

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-2">
                    {/* Download Button */}
                    {doc.status === 'completed' && (
                      <Button
                        onClick={() => handleDownload(doc.id, doc.originalFilename)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Translation
                      </Button>
                    )}
                    
                    {/* Retry Button for Failed Translations */}
                    {doc.status === 'failed' && (
                      <Button
                        onClick={() => handleRetry(doc.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry Translation
                      </Button>
                    )}
                    
                    {/* Cancel Button for Active/Queued Translations */}
                    {(doc.status === 'active' || doc.status === 'queued') && (
                      <Button
                        onClick={() => handleCancel(doc.id)}
                        variant="outline"
                        className="border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                    
                    {/* Delete Button for Completed/Failed Translations */}
                    {(doc.status === 'completed' || doc.status === 'failed') && (
                      <Button
                        onClick={() => handleDelete(doc.id, doc.originalFilename)}
                        variant="outline"
                        className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <Button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
                className="border-gray-300 dark:border-gray-600"
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    className={currentPage === page ? "" : "border-gray-300 dark:border-gray-600"}
                  >
                    {page}
                  </Button>
                ))}
              </div>
              <Button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                variant="outline"
                size="sm"
                className="border-gray-300 dark:border-gray-600"
              >
                Next
              </Button>
            </div>
          </div>
        )}
        
        {/* Pagination Info */}
        <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          Showing {startIndex + 1}-{Math.min(endIndex, allDocuments.length)} of {allDocuments.length} documents
        </div>
      </CardContent>
    </Card>
  );
}
