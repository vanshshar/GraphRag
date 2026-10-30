"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockEmbeddingProvider = void 0;
class MockEmbeddingProvider {
    providerName = 'mock';
    modelName = 'mock-embedding-v1';
    dimension = 384;
    async generateEmbedding(_text) {
        const vector = new Array(this.dimension).fill(0);
        vector[0] = 1.0;
        return vector;
    }
    async generateBatchEmbeddings(texts) {
        return texts.map(() => {
            const v = new Array(this.dimension).fill(0);
            v[0] = 1.0;
            return v;
        });
    }
    async healthCheck() {
        return { ok: true, message: 'Mock embedding provider active' };
    }
}
exports.MockEmbeddingProvider = MockEmbeddingProvider;
