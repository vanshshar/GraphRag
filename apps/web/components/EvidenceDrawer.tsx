'use client';

import React from 'react';
import { X, ExternalLink, Network, FileText, CheckCircle } from 'lucide-react';
import type { CitationItem } from '../lib/api';

interface EvidenceDrawerProps {
  citation: CitationItem | null;
  citationIndex: number | null;
  onClose: () => void;
  onOpenDocument?: (docId: string) => void;
}

export function EvidenceDrawer({
  citation,
  citationIndex,
  onClose,
  onOpenDocument,
}: EvidenceDrawerProps) {
  if (!citation) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col transition-transform duration-300 ease-in-out">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center space-x-2">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-indigo-600 text-white font-bold text-xs">
            {citationIndex !== null ? citationIndex + 1 : 'C'}
          </span>
          <h3 className="font-semibold text-slate-900 text-sm">Grounded Source Citation</h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
        {/* Verification Status */}
        <div className="flex items-center space-x-2 p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Server-verified provenance against indexed graph chunk.</span>
        </div>

        {/* Source Document Card */}
        <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Source Document
            </span>
            {citation.documentId && onOpenDocument && (
              <button
                onClick={() => onOpenDocument(citation.documentId!)}
                className="text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 font-medium"
              >
                <span>View File</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex items-center space-x-2 font-medium text-slate-900">
            <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
            <span className="truncate">{citation.documentTitle || 'Primary Source Document'}</span>
          </div>

          {(citation.pageNumber || citation.section) && (
            <div className="flex items-center space-x-3 text-slate-500 text-[11px] pt-1 border-t border-slate-100">
              {citation.pageNumber && <span>Page {citation.pageNumber}</span>}
              {citation.section && <span>Section: {citation.section}</span>}
            </div>
          )}
        </div>

        {/* Supporting Excerpt */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Verbatim Supporting Excerpt
          </span>
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 font-serif text-slate-800 leading-relaxed text-sm italic">
            "{citation.quote}"
          </div>
        </div>

        {/* Audit Details */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Provenance Audit Identifier
          </span>
          <div className="p-2.5 bg-slate-100 rounded-lg font-mono text-[11px] text-slate-600 break-all select-all">
            {citation.evidenceId}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
        >
          Close Inspector
        </button>
      </div>
    </div>
  );
}

