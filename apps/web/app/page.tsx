'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { DocumentList } from '../components/DocumentList';
import { ChatInterface } from '../components/ChatInterface';
import { DocumentUploadModal } from '../components/DocumentUploadModal';
import { DocumentDetailModal } from '../components/DocumentDetailModal';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import {
  fetchDocuments,
  fetchGraphStats,
  fetchHealthReady,
  deleteDocument,
  type DocumentItem,
  type GraphStats,
  type SystemReadiness,
  type CitationItem,
} from '../lib/api';

export default function Home() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [readiness, setReadiness] = useState<SystemReadiness | null>(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  // Modals and Drawer state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [activeCitation, setActiveCitation] = useState<CitationItem | null>(null);
  const [activeCitationIndex, setActiveCitationIndex] = useState<number | null>(null);

  const loadData = async () => {
    try {
      const [docsData, statsData, readyData] = await Promise.all([
        fetchDocuments().catch(() => ({ documents: [] })),
        fetchGraphStats().catch(() => null),
        fetchHealthReady().catch(() => null),
      ]);
      setDocuments(docsData.documents);
      setStats(statsData);
      setReadiness(readyData);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadData();
    // Refresh readiness and stats periodically
    const timer = setInterval(() => {
      fetchGraphStats().then(setStats).catch(() => {});
      fetchHealthReady().then(setReadiness).catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleDelete = async (id: string) => {
    await deleteDocument(id);
    await loadData();
  };

  const handleCitationClick = (citation: CitationItem, index: number) => {
    setActiveCitation(citation);
    setActiveCitationIndex(index);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Header readiness={readiness} stats={stats} onRefreshStats={loadData} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-4rem)]">
        {/* Left Column: Document Library */}
        <section className="lg:col-span-5 h-[400px] lg:h-full">
          <DocumentList
            documents={documents}
            isLoading={isLoadingDocs}
            onOpenUpload={() => setIsUploadOpen(true)}
            onSelectDocument={(doc) => setSelectedDoc(doc)}
            onDeleteDocument={handleDelete}
            onRefresh={loadData}
          />
        </section>

        {/* Right Column: Chat Interface */}
        <section className="lg:col-span-7 h-[500px] lg:h-full">
          <ChatInterface onCitationClick={handleCitationClick} />
        </section>
      </main>

      {/* Modals & Drawers */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={loadData}
      />

      <DocumentDetailModal
        document={selectedDoc}
        onClose={() => setSelectedDoc(null)}
        onDeleted={handleDelete}
      />

      <EvidenceDrawer
        citation={activeCitation}
        citationIndex={activeCitationIndex}
        onClose={() => {
          setActiveCitation(null);
          setActiveCitationIndex(null);
        }}
        onOpenDocument={(docId) => {
          const doc = documents.find((d) => d.id === docId);
          if (doc) setSelectedDoc(doc);
        }}
      />
    </div>
  );
}

