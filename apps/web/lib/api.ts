export interface DocumentItem {
  id: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  contentHash: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  chunkCount: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CitationItem {
  evidenceId: string;
  quote: string;
  documentTitle?: string;
  documentId?: string;
  chunkId?: string;
  pageNumber?: number | null;
  section?: string | null;
}

export interface ChatResponse {
  answer: string;
  citations: CitationItem[];
  insufficientEvidence: boolean;
  requestId: string;
  timingMs?: number;
  retrievedCount?: number;
}

export interface GraphStats {
  documentCount: number;
  chunkCount: number;
  entityCount: number;
  claimCount: number;
}

export interface SystemReadiness {
  status: 'ready' | 'degraded';
  dependencies: {
    neo4j: { ready: boolean };
    llm: { ready: boolean; provider: string; model: string; note?: string };
    embeddings: { ready: boolean; provider: string; model: string };
  };
  timestamp: string;
}

const API_BASE = typeof window !== 'undefined' ? '' : process.env.API_URL || 'http://localhost:4000';

export async function fetchHealthReady(): Promise<SystemReadiness> {
  const res = await fetch(`${API_BASE}/health/ready`, { cache: 'no-store' });
  return res.json();
}

export async function fetchGraphStats(): Promise<GraphStats> {
  const res = await fetch(`${API_BASE}/api/v1/graph/stats`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch graph statistics');
  const data = await res.json();
  return data.stats;
}

export async function fetchDocuments(page = 1, limit = 20, search?: string): Promise<{
  documents: DocumentItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const url = new URL(`${API_BASE}/api/v1/documents`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  url.searchParams.set('page', page.toString());
  url.searchParams.set('limit', limit.toString());
  if (search) url.searchParams.set('search', search);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch document library');
  return res.json();
}

export async function fetchDocumentDetails(id: string): Promise<DocumentItem> {
  const res = await fetch(`${API_BASE}/api/v1/documents/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch document details');
  const data = await res.json();
  return data.document;
}

export async function uploadDocumentFile(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/api/v1/documents`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to upload document file');
  }
  return res.json();
}

export async function uploadDocumentText(title: string, text: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, text }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to upload document text');
  }
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/documents/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) {
    throw new Error('Failed to delete document');
  }
}

export async function reprocessDocument(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/documents/${id}/reprocess`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to reprocess document');
  return res.json();
}

export async function askQuestion(question: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/v1/chat/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to get answer');
  }
  return res.json();
}

