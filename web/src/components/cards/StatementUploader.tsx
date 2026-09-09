'use client';

import React, { useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import type { StatementPreview } from '@/types';
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatementUploaderProps {
  cardId: string;
  onParsed: (preview: StatementPreview) => void;
  onCancel: () => void;
}

export function StatementUploader({ cardId, onParsed, onCancel }: StatementUploaderProps) {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = useCallback(async (file: File) => {
    // Validate file type
    const validTypes = ['application/pdf', 'text/plain'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.txt')) {
      addToast('error', 'Unsupported file format. Please upload PDF or plain text files.');
      return;
    }

    // Validate file size (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      addToast('error', 'File too large. Maximum size is 10 MB.');
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const preview = await apiClient.uploadStatement(cardId, file);
      clearInterval(progressInterval);
      setUploadProgress(100);

      setTimeout(() => {
        onParsed(preview);
      }, 500);
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'STMT_UNSUPPORTED_FORMAT') {
        addToast('error', 'Unsupported file format.');
      } else if (error.code === 'STMT_FILE_TOO_LARGE') {
        addToast('error', 'File exceeds 10 MB limit.');
      } else if (error.code === 'STMT_PARSE_FAILED') {
        addToast('error', 'Failed to parse statement. Please check the file format.');
      } else {
        addToast('error', 'Upload failed. Please try again.');
      }
      setIsUploading(false);
      setUploadProgress(0);
      setSelectedFile(null);
    }
  }, [cardId, onParsed, addToast]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-4">
      {/* Drag and drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all',
          isDragging
            ? 'border-pulse-blue-500 bg-pulse-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-pulse-blue-400 hover:bg-pulse-blue-50/50',
          isUploading && 'pointer-events-none opacity-75'
        )}
        role="button"
        aria-label="Upload statement file"
        tabIndex={0}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt"
          onChange={handleFileInput}
          className="hidden"
          aria-hidden="true"
        />

        {isUploading ? (
          <>
            <Loader2 className="h-10 w-10 text-pulse-blue-500 animate-spin mb-3" />
            <p className="text-sm font-medium text-gray-900">Uploading...</p>
            <p className="text-xs text-gray-500 mt-1">{selectedFile?.name}</p>
            {/* Progress bar */}
            <div className="w-full max-w-xs mt-4">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pulse-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center mt-1">{uploadProgress}%</p>
            </div>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-900">
              Drag & drop your statement here
            </p>
            <p className="text-xs text-gray-500 mt-1">
              or click to browse • PDF or plain text • Max 10 MB
            </p>
          </>
        )}
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50">
        <AlertCircle className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500">
          Supported formats: PDF and plain text files. The statement will be parsed automatically to extract charges, dates, and amounts.
        </p>
      </div>

      <div className="flex justify-end">
        <button onClick={onCancel} className="btn-secondary" disabled={isUploading}>
          Cancel
        </button>
      </div>
    </div>
  );
}