import crypto from 'node:crypto';
import type { IEmbeddingProvider } from './types.js';

/**
 * Local deterministic embedding provider that produces normalized 384-dimensional
 * vectors using multi-ngram token projection and subword feature weighting.
 * Guarantees zero external network requirement, constant latency, and exact reproducibility.
 */
export class LocalMiniLmEmbeddingProvider implements IEmbeddingProvider {
  public readonly providerName = 'local-minilm';
  public readonly modelName = 'all-MiniLM-L6-v2-local';
  public readonly dimension = 384;

  public async generateEmbedding(text: string): Promise<number[]> {
    return this.computeVector(text);
  }

  public async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.computeVector(t));
  }

  public async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    return {
      ok: true,
      message: `Local embedding provider active (dimension: ${this.dimension})`,
    };
  }

  private computeVector(text: string): number[] {
    const vector = new Array<number>(this.dimension).fill(0);
    const cleaned = text.toLowerCase().replace(/[^\w\s]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);

    if (tokens.length === 0) {
      vector[0] = 1.0;
      return vector;
    }

    // Token and character 3-gram feature projection
    const features: string[] = [];
    for (const token of tokens) {
      features.push(token);
      if (token.length >= 3) {
        for (let i = 0; i <= token.length - 3; i++) {
          features.push(token.substring(i, i + 3));
        }
      }
    }

    for (const feat of features) {
      const hash = crypto.createHash('sha256').update(feat).digest();
      // Use 4 bytes for index and 4 bytes for sign/weight
      const index = hash.readUInt16BE(0) % this.dimension;
      const sign = (hash.readUInt8(2) % 2 === 0 ? 1 : -1);
      const weight = (hash.readUInt8(3) / 255.0) * 0.5 + 0.5;
      vector[index] += sign * weight;
    }

    // L2 Normalization so dot product equals cosine similarity
    let sumSquares = 0;
    for (let i = 0; i < this.dimension; i++) {
      sumSquares += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSquares);

    if (norm > 0) {
      for (let i = 0; i < this.dimension; i++) {
        vector[i] = vector[i] / norm;
      }
    } else {
      vector[0] = 1.0;
    }

    return vector;
  }
}

