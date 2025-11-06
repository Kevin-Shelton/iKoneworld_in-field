'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, Download, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  
  // For skeleton method - immediate translation
  const [translating, setTranslating] = useState(false);
  const [translatedBlob, setTranslatedBlob] = useState<Blob | null>(null);
  const [translatedFilename, setTranslatedFilename] = useState<string>('');
  const [processingTime, setProcessingTime] = useState<number>(0);

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
    setTranslating(true);

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
      
      if (contentType?.includes('application/vnd.openxmlformats')) {
        // Skeleton method - file ready for immediate download
        const blob = await response.blob();
        const filename = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'translated.docx';
        const processingTimeMs = response.headers.get('X-Processing-Time');
        
        // Store blob and filename for manual download
        setTranslatedBlob(blob);
        setTranslatedFilename(filename);
        setProcessingTime(processingTimeMs ? Math.round(parseInt(processingTimeMs) / 1000) : 0);
        
        toast.success(`Translation completed in ${processingTimeMs ? Math.round(parseInt(processingTimeMs) / 1000) : '?'} seconds!`);
      } else {
        // Chunking method - async processing
        const data = await response.json();
        toast.success('Your document has been uploaded and translation will begin shortly.');
        
        // Trigger translation for chunking method
        if (data.conversationId) {
          await fetch(`/api/documents/${data.conversationId}/translate`, {
            method: 'POST',
          });
        }
        
        // Reset form for chunking method
        setSelectedFile(null);
        onUploadComplete();
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
      setTranslating(false);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = () => {
    if (!translatedBlob || !translatedFilename) return;
    
    const url = window.URL.createObjectURL(translatedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = translatedFilename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast.success('File downloaded successfully!');
    
    // Reset form after download
    setSelectedFile(null);
    setTranslatedBlob(null);
    setTranslatedFilename('');
    setTranslating(false);
    onUploadComplete();
  };

  return (
    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-black dark:text-white">Upload Document</CardTitle>
        <CardDescription className="text-black dark:text-gray-300">
          Drag and drop or click to browse
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Translation Progress */}
        {translating && !translatedBlob && (
          <div className="border-2 border-blue-500 rounded-lg p-6 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center justify-center mb-3">
              <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin mr-2" />
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Translating document...
              </p>
            </div>
            <Progress value={50} className="h-2" />
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2 text-center">
              Please wait while we translate your document
            </p>
          </div>
        )}

        {/* Translation Complete - Download Button */}
        {translatedBlob && (
          <div className="border-2 border-green-500 rounded-lg p-6 bg-green-50 dark:bg-green-900/20">
            <div className="flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-green-600 dark:text-green-400 mr-2" />
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                Translation completed in {processingTime} seconds!
              </p>
            </div>
            <Button
              onClick={handleDownload}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Translated Document
            </Button>
            <p className="text-xs text-green-700 dark:text-green-300 mt-2 text-center">
              {translatedFilename}
            </p>
          </div>
        )}

        {/* Upload Form - Hidden when translating */}
        {!translating && (
          <>
            {/* Drag and Drop Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50'
              }`}
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
                <div className="flex flex-col items-center">
                  {selectedFile ? (
                    <>
                      <FileText className="w-12 h-12 text-blue-600 dark:text-blue-400 mb-2" />
                      <p className="text-sm font-medium text-black dark:text-white mb-1">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-black dark:text-gray-400">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400 mb-2" />
                      <p className="text-sm font-medium text-black dark:text-white mb-1">
                        Drop file here or click to browse
                      </p>
                      <p className="text-xs text-black dark:text-gray-400">
                        PDF, DOC, DOCX, TXT • Max 100MB
                      </p>
                    </>
                  )}
                </div>
              </label>
            </div>

            {/* Language Selection */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  Translate from:
                </label>
                <select
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-black dark:text-white"
                  disabled={uploading}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="zh">Chinese</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="ar">Arabic</option>
                  <option value="pt">Portuguese</option>
                  <option value="ru">Russian</option>
                  <option value="it">Italian</option>
                  <option value="nl">Dutch</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                  Translate to:
                </label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-black dark:text-white"
                  disabled={uploading}
                >
                  <option value="es">Spanish</option>
                  <option value="en">English</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="zh">Chinese</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="ar">Arabic</option>
                  <option value="pt">Portuguese</option>
                  <option value="ru">Russian</option>
                  <option value="it">Italian</option>
                  <option value="nl">Dutch</option>
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
                  Translate Document
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
