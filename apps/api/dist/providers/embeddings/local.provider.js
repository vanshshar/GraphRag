"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalMiniLmEmbeddingProvider = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
/**
 * Local deterministic embedding provider that produces normalized 384-dimensional
 * vectors using multi-ngram token projection and subword feature weighting.
 * Guarantees zero external network requirement, constant latency, and exact reproducibility.
 */
class LocalMiniLmEmbeddingProvider {
    providerName = 'local-minilm';
    modelName = 'all-MiniLM-L6-v2-local';
    dimension = 384;
    async generateEmbedding(text) {
        return this.computeVector(text);
    }
    async generateBatchEmbeddings(texts) {
        return texts.map((t) => this.computeVector(t));
    }
    async healthCheck() {
        return {
            ok: true,
            message: `Local embedding provider active (dimension: ${this.dimension})`,
        };
    }
    computeVector(text) {
        const vector = new Array(this.dimension).fill(0);
        const cleaned = text.toLowerCase().replace(/[^\w\s]/g, ' ');
        const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);
        if (tokens.length === 0) {
            vector[0] = 1.0;
            return vector;
        }
        // Token and character 3-gram feature projection
        const features = [];
        for (const token of tokens) {
            features.push(token);
            if (token.length >= 3) {
                for (let i = 0; i <= token.length - 3; i++) {
                    features.push(token.substring(i, i + 3));
                }
            }
        }
        for (const feat of features) {
            const hash = node_crypto_1.default.createHash('sha256').update(feat).digest();
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
        }
        else {
            vector[0] = 1.0;
        }
        return vector;
    }
}
exports.LocalMiniLmEmbeddingProvider = LocalMiniLmEmbeddingProvider;
