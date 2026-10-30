import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { InMemoryDocumentRepository, InMemoryGraphRepository } from '../../src/repositories/memory.repository.js';
import { MockLlmProvider } from '../../src/providers/llm/mock.provider.js';
import { LocalMiniLmEmbeddingProvider } from '../../src/providers/embeddings/local.provider.js';

describe('End-to-End GraphRAG User Journey', () => {
  it('completes the full journey: document upload -> chunking -> entity extraction -> hybrid retrieval -> grounded answer with verifiable citations', async () => {
    const docRepo = new InMemoryDocumentRepository();
    const graphRepo = new InMemoryGraphRepository();
    const llmProvider = new MockLlmProvider();
    const embeddingProvider = new LocalMiniLmEmbeddingProvider();

    const app = createApp({
      documentRepo: docRepo,
      graphRepo,
      llmProvider,
      embeddingProvider,
    });

    // Step 1: Upload a technical document
    const uploadRes = await request(app)
      .post('/api/v1/documents')
      .send({
        title: 'Technology Stack',
        text: 'Node.js is an asynchronous event-driven JavaScript runtime. Express.js is a web framework built on Node.js.',
      });

    expect(uploadRes.status).toBe(201);
    const docId = uploadRes.body.documentId;
    expect(docId).toBeDefined();

    // Step 2: Verify document was indexed and chunks were generated
    const docDetail = await request(app).get(`/api/v1/documents/${docId}`);
    expect(docDetail.status).toBe(200);
    expect(docDetail.body.document.status).toBe('completed');
    expect(docDetail.body.document.chunkCount).toBeGreaterThan(0);

    // Step 3: Query the knowledge graph
    const chatRes = await request(app)
      .post('/api/v1/chat/query')
      .send({
        question: 'What runtime is Express.js built on?',
      });

    expect(chatRes.status).toBe(200);
    expect(chatRes.body.answer).toBeDefined();
    expect(chatRes.body.citations.length).toBeGreaterThan(0);

    // Step 4: Verify the citation points to the real ingested document
    const citation = chatRes.body.citations[0];
    expect(citation.documentTitle).toBe('Technology Stack');
    expect(citation.evidenceId).toContain(`chunk_${docId}`);
    expect(citation.quote).toBeDefined();
  });
});

