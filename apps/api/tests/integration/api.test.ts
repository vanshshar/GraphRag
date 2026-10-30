import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { InMemoryDocumentRepository, InMemoryGraphRepository } from '../../src/repositories/memory.repository.js';
import { MockLlmProvider } from '../../src/providers/llm/mock.provider.js';
import { MockEmbeddingProvider } from '../../src/providers/embeddings/mock.provider.js';

describe('API Route Integration Tests', () => {
  let app: any;
  let docRepo: InMemoryDocumentRepository;
  let graphRepo: InMemoryGraphRepository;
  let llmProvider: MockLlmProvider;
  let embeddingProvider: MockEmbeddingProvider;

  beforeEach(() => {
    docRepo = new InMemoryDocumentRepository();
    graphRepo = new InMemoryGraphRepository();
    llmProvider = new MockLlmProvider();
    embeddingProvider = new MockEmbeddingProvider();

    app = createApp({
      documentRepo: docRepo,
      graphRepo,
      llmProvider,
      embeddingProvider,
    });
  });

  it('GET /health/live returns 200 with ok status', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('POST /api/v1/documents rejects empty request with 400 and consistent error envelope', async () => {
    const res = await request(app).post('/api/v1/documents').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.requestId).toBeDefined();
  });

  it('POST /api/v1/documents successfully ingests a text document', async () => {
    const res = await request(app)
      .post('/api/v1/documents')
      .send({
        title: 'Microservices vs Monoliths',
        text: 'A modular monolith provides high cohesion with low deployment overhead compared to distributed microservices.',
      });

    expect(res.status).toBe(201);
    expect(res.body.documentId).toBeDefined();
    expect(res.body.status).toBe('completed');
    expect(res.body.chunkCount).toBe(1);

    // Verify document can be fetched via GET /api/v1/documents/:id
    const detailRes = await request(app).get(`/api/v1/documents/${res.body.documentId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.document.title).toBe('Microservices vs Monoliths');
  });

  it('GET /api/v1/documents returns paginated list', async () => {
    await request(app).post('/api/v1/documents').send({
      title: 'Doc A',
      text: 'Content of Doc A',
    });
    await request(app).post('/api/v1/documents').send({
      title: 'Doc B',
      text: 'Content of Doc B',
    });

    const res = await request(app).get('/api/v1/documents?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.documents.length).toBe(2);
    expect(res.body.pagination.total).toBe(2);
  });

  it('POST /api/v1/chat/query answers question with grounded citations', async () => {
    // Ingest source material
    await request(app).post('/api/v1/documents').send({
      title: 'Express Guide',
      text: 'Express.js is a minimal and flexible Node.js web application framework.',
    });

    const res = await request(app).post('/api/v1/chat/query').send({
      question: 'What is Express.js?',
    });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBeDefined();
    expect(res.body.citations).toBeInstanceOf(Array);
    expect(res.body.requestId).toBeDefined();
  });

  it('GET /api/v1/graph/stats returns graph metrics', async () => {
    const res = await request(app).get('/api/v1/graph/stats');
    expect(res.status).toBe(200);
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.chunkCount).toBeDefined();
  });

  it('DELETE /api/v1/documents/:id returns 204 on safe deletion', async () => {
    const uploadRes = await request(app).post('/api/v1/documents').send({
      title: 'Temporary Doc',
      text: 'Will be deleted shortly.',
    });

    const deleteRes = await request(app).delete(`/api/v1/documents/${uploadRes.body.documentId}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get(`/api/v1/documents/${uploadRes.body.documentId}`);
    expect(getRes.status).toBe(404);
  });
});

