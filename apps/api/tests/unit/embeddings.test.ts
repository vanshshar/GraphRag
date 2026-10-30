import { describe, it, expect } from 'vitest';
import { LocalMiniLmEmbeddingProvider } from '../../src/providers/embeddings/local.provider.js';
import { cosineSimilarity } from '../../src/providers/embeddings/types.js';

describe('LocalMiniLmEmbeddingProvider', () => {
  const provider = new LocalMiniLmEmbeddingProvider();

  it('produces 384-dimensional normalized vectors', async () => {
    const text = 'Graph retrieval augmented generation combines knowledge graphs with language models.';
    const vector = await provider.generateEmbedding(text);

    expect(vector).toHaveLength(384);

    // Verify L2 norm is approximately 1.0
    const sumSquares = vector.reduce((sum, val) => sum + val * val, 0);
    expect(Math.abs(Math.sqrt(sumSquares) - 1.0)).toBeLessThan(0.001);
  });

  it('is completely deterministic for identical inputs', async () => {
    const text = 'Neo4j Bolt protocol';
    const vec1 = await provider.generateEmbedding(text);
    const vec2 = await provider.generateEmbedding(text);

    expect(vec1).toEqual(vec2);
  });

  it('scores semantically related texts higher than unrelated texts', async () => {
    const query = 'graph database query';
    const related = 'executing cypher queries on a graph database';
    const unrelated = 'baking chocolate chip cookies in an oven';

    const qVec = await provider.generateEmbedding(query);
    const rVec = await provider.generateEmbedding(related);
    const uVec = await provider.generateEmbedding(unrelated);

    const simRelated = cosineSimilarity(qVec, rVec);
    const simUnrelated = cosineSimilarity(qVec, uVec);

    expect(simRelated).toBeGreaterThan(simUnrelated);
  });
});

