'use client';

import React, { useState } from 'react';
import {
  FileText,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCw,
  Search,
  Plus,
} from 'lucide-react';
import type { DocumentItem } from '../lib/api';
import { formatBytes, formatDate } from '../lib/utils';

interface DocumentListProps {
  documents: DocumentItem[];
  isLoading: boolean;
  onOpenUpload: () => void;
  onSelectDocument: (doc: DocumentItem) => void;
  onDeleteDocument: (id: string) => Promise<void>;
  onRefresh: () => void;
}

export function DocumentList({
  documents,
  isLoading,
  onOpenUpload,
  onSelectDocument,
  onDeleteDocument,
  onRefresh,
}: DocumentListProps) {
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredDocs = documents.filter((doc) =>
    doc.title.toLowerCase().includes(search.toLowerCase()) ||
    doc.originalFilename.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this document and its associated graph chunks? Shared entities referenced by other documents will be preserved.')) {
      return;
    }
    setDeletingId(id);
    try {
      await onDeleteDocument(id);
    } finally {
      setDeletingId(null);
    }
  };

  const renderStatusBadge = (status: DocumentItem['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
            Indexed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <RotateCw className="h-3 w-3 mr-1 text-amber-600 animate-spin" />
            Extracting Graph
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="h-3 w-3 mr-1 text-rose-600" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="h-3 w-3 mr-1 text-slate-500" />
            Queued
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header toolbar */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Document Library</h2>
          <p className="text-xs text-slate-500">Indexed source files powering the Knowledge Graph</p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Search box */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search library..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36 sm:w-48"
            />
          </div>

          <button
            onClick={onOpenUpload}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm shadow-indigo-100"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Upload</span>
          </button>
        </div>
      </div>

      {/* Document List View */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Loading document library...
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">No documents indexed yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Upload notes, specifications, or guides to begin extracting entities and querying the graph.
            </p>
            <button
              onClick={onOpenUpload}
              className="mt-4 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-medium rounded-lg transition-colors"
            >
              Upload your first document
            </button>
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => onSelectDocument(doc)}
              className="p-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-start space-x-3 min-w-0 pr-4">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 border border-indigo-100">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-900 truncate">
                      {doc.title}
                    </span>
                    {renderStatusBadge(doc.status)}
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 mt-0.5">
                    <span>{doc.chunkCount} chunks</span>
                    <span>•</span>
                    <span>{formatBytes(doc.fileSize)}</span>
                    <span>•</span>
                    <span>{formatDate(doc.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectDocument(doc);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                  title="Inspect Details"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => handleDelete(e, doc.id)}
                  disabled={deletingId === doc.id}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                  title="Safe Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

