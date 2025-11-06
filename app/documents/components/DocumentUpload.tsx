'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DocumentUploadProps {
  userId: number;
  enterpriseId?: string;
  onUploadComplete: () => void;
}

export default function DocumentUpload({ userId, enterpriseId, onUploadComplete }: DocumentUploadProps) {
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

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('userId', userId.toString());
      if (enterpriseId) {
        formData.append('enterpriseId', enterpriseId);
      }
      formData.append('sourceLanguage', sourceLanguage);
      formData.append('targetLanguage', targetLanguage);

      // Use smart routing endpoint
      const response = await fetch('/api/documents/upload-smart', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      // Check if response is a file (skeleton method) or JSON (chunking method)
      const contentType = response.headers.get('Content-Type');
      
      if (contentType?.includes('application/json')) {
        // Chunking method - async processing
        const data = await response.json();
        toast.success('Document added to translation queue');
        
        // Trigger translation for chunking method
        if (data.conversationId) {
          await fetch(`/api/documents/${data.conversationId}/translate`, {
            method: 'POST',
          });
        }
      } else {
        // Skeleton method - save to database instead of immediate download
        // For now, show success message - we'll update this to save to DB
        toast.success('Document translation started');
      }

      // Reset form
      setSelectedFile(null);
      onUploadComplete();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
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
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="flex flex-col items-center mb-4">
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
                    PDF, DOC, DOCX, TXT • Max 100MB
                  </p>
                </>
              )}
            </div>
          </label>

          {/* Language Selection */}
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
      </CardContent>
    </Card>
  );
}
