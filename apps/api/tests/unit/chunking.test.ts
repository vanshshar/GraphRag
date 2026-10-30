import { describe, it, expect } from 'vitest';
import { ChunkingService } from '../../src/services/chunking.service.js';

describe('ChunkingService', () => {
  it('returns empty array when text is empty', () => {
    const chunks = ChunkingService.chunkText('doc-1', '', {
      chunkSize: 500,
      chunkOverlap: 50,
    });
    expect(chunks).toEqual([]);
  });

  it('creates single chunk when text length is within chunkSize', () => {
    const text = 'Neo4j is a high-performance graph database engine.';
    const chunks = ChunkingService.chunkText('doc-1', text, {
      chunkSize: 500,
      chunkOverlap: 50,
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(text);
    expect(chunks[0].id).toBe('chunk_doc-1_0');
    expect(chunks[0].tokenEstimate).toBeGreaterThan(0);
    expect(chunks[0].contentHash).toBeDefined();
  });

  it('splits long text into overlapping chunks with sliding window', () => {
    const paragraph1 = 'Sentence one in the first paragraph. Sentence two in the first paragraph. ';
    const paragraph2 = 'Sentence three in the second paragraph. Sentence four in the second paragraph. ';
    const longText = (paragraph1 + paragraph2).repeat(10);

    const chunks = ChunkingService.chunkText('doc-2', longText, {
      chunkSize: 150,
      chunkOverlap: 30,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[1].index).toBe(1);

    // Verify chunk IDs follow naming pattern
    expect(chunks[0].id).toBe('chunk_doc-2_0');
    expect(chunks[1].id).toBe('chunk_doc-2_1');

    // Verify overlap exists between consecutive chunks
    const firstChunkWords = chunks[0].text.split(' ');
    const secondChunkWords = chunks[1].text.split(' ');
    const commonWords = firstChunkWords.filter((w) => secondChunkWords.includes(w) && w.length > 4);
    expect(commonWords.length).toBeGreaterThan(0);
  });

  it('detects markdown headers as section titles', () => {
    const markdown = '# Architecture Overview\nGraphRAG integrates Neo4j with Groq.';
    const chunks = ChunkingService.chunkText('doc-3', markdown, {
      chunkSize: 500,
      chunkOverlap: 50,
    });
    expect(chunks[0].section).toBe('Architecture Overview');
  });
});

