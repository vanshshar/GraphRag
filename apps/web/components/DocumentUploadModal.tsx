'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { uploadDocumentFile, uploadDocumentText } from '../lib/api';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DocumentUploadModal({ isOpen, onClose, onSuccess }: DocumentUploadModalProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [rawTitle, setRawTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = e.dataTransfer.files[0];
      validateAndSetFile(selected);
    }
  };

  const validateAndSetFile = (f: File) => {
    setError(null);
    if (f.size > 10 * 1024 * 1024) {
      setError('File exceeds maximum limit of 10MB.');
      return;
    }
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsUploading(true);

    try {
      if (activeTab === 'file') {
        if (!file) {
          setError('Please select a file to upload.');
          setIsUploading(false);
          return;
        }
        await uploadDocumentFile(file);
      } else {
        if (!rawTitle.trim() || !rawText.trim()) {
          setError('Please provide both title and content text.');
          setIsUploading(false);
          return;
        }
        await uploadDocumentText(rawTitle.trim(), rawText.trim());
      }

      setSuccess('Document uploaded successfully and indexed into knowledge graph!');
      setTimeout(() => {
        setIsUploading(false);
        setSuccess(null);
        setFile(null);
        setRawTitle('');
        setRawText('');
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setIsUploading(false);
      setError(err.message || 'Upload failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <UploadCloud className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900">Ingest Document</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-100 px-6 pt-3 space-x-4 text-sm font-medium text-slate-500">
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'file'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent hover:text-slate-700'
            }`}
          >
            Upload File (.txt, .md, .pdf, .json, .csv)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'text'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent hover:text-slate-700'
            }`}
          >
            Paste Text
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start space-x-2 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start space-x-2 p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {activeTab === 'file' ? (
            <div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-indigo-50/30"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".txt,.md,.markdown,.pdf,.json,.csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      validateAndSetFile(e.target.files[0]);
                    }
                  }}
                />
                <FileText className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">
                  {file ? file.name : 'Click to select or drag and drop a file'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supported formats: TXT, Markdown, PDF, JSON, CSV (Max 10MB)
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Distributed Database Architecture"
                  value={rawTitle}
                  onChange={(e) => setRawTitle(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Document Content
                </label>
                <textarea
                  rows={6}
                  placeholder="Paste verbatim text, documentation, or notes here..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 shadow-sm shadow-indigo-200"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing & Ingesting...</span>
                </>
              ) : (
                <span>Ingest Document</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

