import type { IEmbeddingProvider } from './types.js';

export class MockEmbeddingProvider implements IEmbeddingProvider {
  public readonly providerName = 'mock';
  public readonly modelName = 'mock-embedding-v1';
  public readonly dimension = 384;

  public async generateEmbedding(_text: string): Promise<number[]> {
    const vector = new Array<number>(this.dimension).fill(0);
    vector[0] = 1.0;
    return vector;
  }

  public async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return texts.map(() => {
      const v = new Array<number>(this.dimension).fill(0);
      v[0] = 1.0;
      return v;
    });
  }

  public async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true, message: 'Mock embedding provider active' };
  }
}

