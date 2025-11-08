'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { retryFetch } from '@/lib/retryUtils';
import { uploadDocumentToSupabaseClient } from '@/lib/supabase/client-storage';

interface DocumentUploadProps {
  userId: number;
  enterpriseId?: string;
  onUploadComplete: () => void;
  onUploadStart?: (fileInfo: any) => void;
}

export default function DocumentUpload({ userId, enterpriseId, onUploadComplete, onUploadStart }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('es');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    if (sourceLanguage === targetLanguage) {
      toast.error('Source and target languages must be different');
      return;
    }

    // Validate file type
    const fileName = selectedFile.name.toLowerCase();
    const validExtensions = ['.pdf', '.docx', '.pptx', '.txt'];
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
      toast.error(
        '📄 File type not supported for demo',
        {
          description: 'Please upload PDF, Word (.docx), PowerPoint (.pptx), or Text (.txt) files. Need help? Contact us!',
          duration: 6000,
        }
      );
      return;
    }

    // Validate file size (200MB limit for demo)
    const maxSizeBytes = 200 * 1024 * 1024; // 200MB
    const fileSizeMB = (selectedFile.size / (1024 * 1024)).toFixed(1);
    
    if (selectedFile.size > maxSizeBytes) {
      toast.error(
        '📦 File too large for demo',
        {
          description: `Your file is ${fileSizeMB}MB. Demo limit is 200MB. For larger files, please contact our team!`,
          duration: 6000,
        }
      );
      return;
    }

    setUploading(true);
    
    // Store file info before clearing
    const fileToUpload = selectedFile;
    
    // Generate a temporary conversation ID for the upload path
    const tempConversationId = Date.now();
    
    // Estimate method and time based on file type and size
    const fileSizeKB = fileToUpload.size / 1024;
    const isPdf = fileToUpload.name.endsWith('.pdf');
    const isDocx = fileToUpload.name.endsWith('.docx');
    const isPptx = fileToUpload.name.endsWith('.pptx');
    const isTxt = fileToUpload.name.endsWith('.txt');
    
    let method = 'chunking';
    let estimatedTime = Math.ceil(fileSizeKB / 10); // ~1 second per 10KB
    
    if (isPdf) {
      method = 'pdf-deepl-async';
      estimatedTime = Math.ceil(fileSizeKB / 5); // PDFs take ~2x longer
    } else if (isPptx) {
      method = 'pptx-deepl-async';
      estimatedTime = Math.ceil(fileSizeKB / 4); // PowerPoint takes longer
    } else if (isDocx) {
      method = 'docx-deepl-async';
      estimatedTime = Math.ceil(fileSizeKB / 5); // DOCX with DeepL
    } else if (isTxt && fileSizeKB < 100) {
      method = 'txt-verbum-sync';
      estimatedTime = Math.ceil(fileSizeKB / 20); // Text is fast
    } else if (isTxt && fileSizeKB >= 100) {
      method = 'txt-verbum-async';
      estimatedTime = Math.ceil(fileSizeKB / 15); // Large text
    }
    
    // Notify parent to show optimistic UI immediately
    if (onUploadStart) {
      onUploadStart({
        filename: fileToUpload.name,
        fileType: fileToUpload.type,
        fileSize: fileToUpload.size,
        sourceLanguage,
        targetLanguage,
        method,
        estimatedTime,
      });
    }
    
    // Clear the upload box immediately for better UX
    setSelectedFile(null);

    try {
      // Step 1: Upload file directly to Supabase Storage (bypasses Vercel 4.5MB limit)
      console.log('[Upload] Uploading to Supabase Storage...');
      const storagePath = await uploadDocumentToSupabaseClient({
        file: fileToUpload,
        fileName: fileToUpload.name,
        enterpriseId: enterpriseId || 'default',
        userId: userId,
        conversationId: tempConversationId,
        isTranslated: false,
      });
      
      console.log('[Upload] File uploaded to storage:', storagePath);
      
      // Step 2: Create document record with metadata only
      const response = await retryFetch('/api/documents/create-from-storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          enterpriseId: enterpriseId || null,
          fileName: fileToUpload.name,
          fileSize: fileToUpload.size,
          fileType: fileToUpload.type,
          storagePath: storagePath,
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage,
        }),
      }, {
        maxAttempts: 3,
        onRetry: (attempt, error) => {
          toast.info(`Creating document record (attempt ${attempt})...`);
          console.log(`[Upload Retry] Attempt ${attempt} failed:`, error.message);
        }
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.message || error.error || 'Upload failed';
        const errorDetails = error.details ? `\n${error.details}` : '';
        throw new Error(`${errorMessage}${errorDetails}`);
      }

      // Both methods now return JSON, check the method field
      const data = await response.json();
      console.log('[Upload] Response data:', data);
      
      if (data.method === 'chunking') {
        // Chunking method - trigger async translation
        toast.success('Document added to translation queue');
        
        // Trigger translation for chunking method with retry
        if (data.conversationId) {
          await retryFetch(`/api/documents/${data.conversationId}/translate`, {
            method: 'POST',
          }, {
            maxAttempts: 3,
            onRetry: (attempt) => {
              console.log(`[Translation Retry] Attempt ${attempt} failed, retrying...`);
            }
          });
        }
      } else if (data.method === 'pdf-deepl-async') {
        // PDF DeepL method - trigger async translation
        toast.success('PDF added to translation queue');
        
        // Trigger PDF translation with retry
        if (data.conversationId) {
          await retryFetch('/api/documents/process-pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              conversationId: data.conversationId,
            }),
          }, {
            maxAttempts: 3,
            onRetry: (attempt) => {
              console.log(`[Upload] Retrying PDF translation (attempt ${attempt})`);
            },
          });
        }
      } else if (data.method === 'docx-deepl-async') {
        // DOCX DeepL method - trigger async translation
        toast.success('DOCX added to translation queue with complete format preservation');
        
        // Trigger DOCX translation with retry
        if (data.conversationId) {
          await retryFetch('/api/documents/process-docx', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              conversationId: data.conversationId,
            }),
          }, {
            maxAttempts: 3,
            onRetry: (attempt) => {
              console.log(`[DOCX Translation Retry] Attempt ${attempt} failed, retrying...`);
            }
          });
        }
      } else if (data.method === 'pptx-deepl-async') {
        // PowerPoint DeepL method - trigger async translation
        toast.success('PowerPoint added to translation queue with complete format preservation');
        
        // Trigger PPTX translation with retry
        if (data.conversationId) {
          await retryFetch('/api/documents/process-pptx', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              conversationId: data.conversationId,
            }),
          }, {
            maxAttempts: 3,
            onRetry: (attempt) => {
              console.log(`[PPTX Translation Retry] Attempt ${attempt} failed, retrying...`);
            }
          });
        }
      } else if (data.method === 'txt-verbum-async') {
        // Large text file Verbum method - trigger async translation
        toast.success('Text file added to translation queue');
        
        // Trigger TXT translation with retry
        if (data.conversationId) {
          await retryFetch('/api/documents/process-txt', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              conversationId: data.conversationId,
            }),
          }, {
            maxAttempts: 3,
            onRetry: (attempt) => {
              console.log(`[TXT Translation Retry] Attempt ${attempt} failed, retrying...`);
            }
          });
        }
      } else if (data.method === 'txt-verbum-sync') {
        // Small text file - translation already completed
        toast.success('Text file translated successfully!');
      } else if (data.method === 'skeleton') {
        // Legacy skeleton method - translation already completed
        toast.success('Document translated successfully!');
      }

      // Refresh document list to show updated status
      onUploadComplete();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-white dark:bg-gray-800 border-2 border-dashed border-green-400 dark:border-green-600">
        <CardContent className="p-6">
          {/* Drag and Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className="text-center"
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.pptx"
              onChange={handleFileSelect}
              disabled={uploading}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-yellow-400 rounded-lg flex items-center justify-center mb-3">
                  <FileText className="w-8 h-8 text-gray-800" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Upload Document for Translation
                </h3>
                {selectedFile ? (
                  <>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Drag and drop files here or click to browse
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      PDF, DOCX, PPTX, TXT • Max 200MB
                    </p>
                  </>
                )}
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Language Selection - Now outside the green border */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
        <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                disabled={uploading}
              >
                <option value="en">Translate from: English</option>
                <option value="es">Translate from: Spanish</option>
                <option value="fr">Translate from: French</option>
                <option value="de">Translate from: German</option>
                <option value="zh">Translate from: Chinese</option>
                <option value="ja">Translate from: Japanese</option>
                <option value="ko">Translate from: Korean</option>
                <option value="ar">Translate from: Arabic</option>
                <option value="pt">Translate from: Portuguese</option>
                <option value="ru">Translate from: Russian</option>
                <option value="it">Translate from: Italian</option>
                <option value="nl">Translate from: Dutch</option>
              </select>
            </div>

            <div className="flex-1">
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                disabled={uploading}
              >
                <option value="es">Translate to: Spanish</option>
                <option value="en">Translate to: English</option>
                <option value="fr">Translate to: French</option>
                <option value="de">Translate to: German</option>
                <option value="zh">Translate to: Chinese</option>
                <option value="ja">Translate to: Japanese</option>
                <option value="ko">Translate to: Korean</option>
                <option value="ar">Translate to: Arabic</option>
                <option value="pt">Translate to: Portuguese</option>
                <option value="ru">Translate to: Russian</option>
                <option value="it">Translate to: Italian</option>
                <option value="nl">Translate to: Dutch</option>
              </select>
            </div>
        </div>

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload and Translate
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
