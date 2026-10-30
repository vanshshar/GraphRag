'use client';

import React, { useState } from 'react';
import { X, FileText, Hash, Clock, HardDrive, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import type { DocumentItem } from '../lib/api';
import { formatBytes, formatDate } from '../lib/utils';
import { reprocessDocument } from '../lib/api';

interface DocumentDetailModalProps {
  document: DocumentItem | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

export function DocumentDetailModal({ document, onClose, onDeleted }: DocumentDetailModalProps) {
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!document) return null;

  const handleReprocess = async () => {
    setIsReprocessing(true);
    setError(null);
    try {
      await reprocessDocument(document.id);
      setIsReprocessing(false);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Reprocessing failed.');
      setIsReprocessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-sm truncate max-w-xs">{document.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="flex items-start space-x-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {document.errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              <strong className="block font-medium mb-0.5">Ingestion Error Diagnostic:</strong>
              <p className="font-mono text-[11px]">{document.errorMessage}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200/80">
            <div>
              <span className="text-slate-400 block mb-0.5">Original File</span>
              <span className="font-medium text-slate-800 break-all">{document.originalFilename}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">MIME Type</span>
              <span className="font-mono text-slate-800">{document.mimeType}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">File Size</span>
              <span className="font-medium text-slate-800">{formatBytes(document.fileSize)}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Generated Chunks</span>
              <span className="font-medium text-slate-800">{document.chunkCount} indexed</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400 block mb-0.5">SHA-256 Provenance Hash</span>
              <span className="font-mono text-[10px] text-slate-600 break-all bg-white px-2 py-1 rounded border border-slate-200 block">
                {document.contentHash}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">First Indexed</span>
              <span className="text-slate-600">{formatDate(document.createdAt)}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Last Updated</span>
              <span className="text-slate-600">{formatDate(document.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-t border-slate-100">
          <button
            onClick={() => {
              if (window.confirm('Delete this document?')) {
                onDeleted(document.id);
                onClose();
              }
            }}
            className="flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-700 font-medium"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Safe Delete</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleReprocess}
              disabled={isReprocessing}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isReprocessing ? 'animate-spin' : ''}`} />
              <span>Reprocess</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

