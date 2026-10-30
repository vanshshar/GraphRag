import { describe, it, expect } from 'vitest';
import { AnsweringService } from '../../src/services/answering.service.js';
import { RetrievalService } from '../../src/services/retrieval.service.js';
import { MockLlmProvider } from '../../src/providers/llm/mock.provider.js';
import { MockEmbeddingProvider } from '../../src/providers/embeddings/mock.provider.js';
import { InMemoryGraphRepository, InMemoryDocumentRepository } from '../../src/repositories/memory.repository.js';

describe('AnsweringService & Citation Validation', () => {
  it('discards hallucinated citation IDs that were not retrieved', async () => {
    const docRepo = new InMemoryDocumentRepository();
    const graphRepo = new InMemoryGraphRepository();
    const llmProvider = new MockLlmProvider();
    const embeddingProvider = new MockEmbeddingProvider();

    // Populate a document and chunk
    await docRepo.create({
      id: 'doc-real',
      title: 'GraphRAG Guide',
      originalFilename: 'guide.txt',
      mimeType: 'text/plain',
      fileSize: 100,
      contentHash: 'hash1',
      status: 'completed',
      chunkCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await graphRepo.saveChunks('doc-real', [
      {
        id: 'chunk_real_0',
        documentId: 'doc-real',
        index: 0,
        text: 'Graph databases store nodes and edges for relationship traversal.',
        tokenEstimate: 20,
        contentHash: 'chunkhash1',
      },
    ]);

    // Configure Mock LLM to return one real citation and one fake hallucinated citation
    llmProvider.customAnswerResponse = {
      answer: 'Graph databases use nodes and edges to traverse connected data.',
      citations: [
        {
          evidenceId: 'chunk_real_0', // Valid
          quote: 'Graph databases store nodes and edges',
        },
        {
          evidenceId: 'fake_hallucinated_chunk_999', // Invalid
          quote: 'This sentence was made up by the model.',
        },
      ],
      insufficientEvidence: false,
    };

    const retrievalService = new RetrievalService(graphRepo, docRepo, embeddingProvider);
    const answeringService = new AnsweringService(retrievalService, llmProvider, graphRepo);

    const response = await answeringService.answerQuestion(
      'What do graph databases store?',
      'req-test-1'
    );

    expect(response.answer).toBeDefined();
    // Verify that the server filtered out the hallucinated citation ID!
    expect(response.citations).toHaveLength(1);
    expect(response.citations[0].evidenceId).toBe('chunk_real_0');
    expect(response.citations[0].documentTitle).toBe('GraphRAG Guide');
  });

  it('returns insufficientEvidence when no evidence matches question', async () => {
    const docRepo = new InMemoryDocumentRepository();
    const graphRepo = new InMemoryGraphRepository();
    const llmProvider = new MockLlmProvider();
    const embeddingProvider = new MockEmbeddingProvider();

    const retrievalService = new RetrievalService(graphRepo, docRepo, embeddingProvider);
    const answeringService = new AnsweringService(retrievalService, llmProvider, graphRepo);

    const response = await answeringService.answerQuestion(
      'What is quantum teleportation?',
      'req-test-2'
    );

    expect(response.insufficientEvidence).toBe(true);
    expect(response.citations).toHaveLength(0);
    expect(response.answer).toContain('could not find any relevant information');
  });
});
