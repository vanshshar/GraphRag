"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetrievalService = void 0;
const types_js_1 = require("../providers/embeddings/types.js");
const logger_js_1 = require("../utils/logger.js");
class RetrievalService {
    graphRepo;
    docRepo;
    embeddingProvider;
    constructor(graphRepo, docRepo, embeddingProvider) {
        this.graphRepo = graphRepo;
        this.docRepo = docRepo;
        this.embeddingProvider = embeddingProvider;
    }
    async retrieve(question, options = {}) {
        const topK = options.topK ?? 8;
        const maxHops = options.maxHops ?? 2;
        const maxTokens = options.maxContextTokens ?? 3000;
        logger_js_1.logger.debug({ question, topK, maxHops }, 'Starting hybrid retrieval');
        // 1. Extract query tokens and keywords
        const keywords = this.extractQueryKeywords(question);
        // 2. Exact and normalized entity lookup
        const matchedEntities = await this.graphRepo.findEntitiesByKeywords(keywords);
        const entityIds = matchedEntities.map((e) => e.id);
        // 3. Bounded Graph Traversal from matched entities
        let connectedClaims = [];
        let graphChunkIds = [];
        if (entityIds.length > 0) {
            const traversal = await this.graphRepo.traverseGraphFromEntities(entityIds, maxHops, 25);
            connectedClaims = traversal.claims;
            graphChunkIds = traversal.supportingChunkIds;
        }
        // 4. Lexical Search
        const lexicalChunks = [];
        for (const kw of keywords.slice(0, 5)) {
            const found = await this.graphRepo.searchChunksByKeyword(kw, 5);
            lexicalChunks.push(...found);
        }
        // 5. Semantic Vector Retrieval
        let queryEmbedding = [];
        try {
            queryEmbedding = await this.embeddingProvider.generateEmbedding(question);
        }
        catch (embErr) {
            logger_js_1.logger.warn({ error: embErr.message }, 'Embedding generation failed during retrieval');
        }
        // Combine candidate chunks
        const candidateChunkMap = new Map();
        // Add chunks found via graph traversal
        if (graphChunkIds.length > 0) {
            const gChunks = await this.graphRepo.getChunksByIds(graphChunkIds);
            for (const gc of gChunks)
                candidateChunkMap.set(gc.id, gc);
        }
        // Add chunks found via lexical search
        for (const lc of lexicalChunks) {
            candidateChunkMap.set(lc.id, lc);
        }
        const candidateChunks = Array.from(candidateChunkMap.values());
        const scored = candidateChunks.map((chunk) => {
            // Semantic score
            let semanticScore = 0;
            if (queryEmbedding.length > 0 && chunk.embedding && chunk.embedding.length > 0) {
                semanticScore = Math.max(0, (0, types_js_1.cosineSimilarity)(queryEmbedding, chunk.embedding));
            }
            // Lexical overlap score
            const chunkLower = chunk.text.toLowerCase();
            let matches = 0;
            for (const kw of keywords) {
                if (chunkLower.includes(kw.toLowerCase()))
                    matches++;
            }
            const lexicalScore = keywords.length > 0 ? matches / keywords.length : 0;
            // Graph relevance score (boost chunks directly supporting an extracted claim)
            const isGraphSupported = graphChunkIds.includes(chunk.id);
            const graphScore = isGraphSupported ? 1.0 : 0.0;
            const finalScore = 0.5 * semanticScore + 0.3 * lexicalScore + 0.2 * graphScore;
            return { chunk, score: finalScore };
        });
        // Sort descending by score
        scored.sort((a, b) => b.score - a.score);
        // Take topK
        const topChunks = scored.slice(0, topK);
        // 7. Context Budget & Provenance Mapping
        let currentTokens = 0;
        const evidenceInputs = [];
        // Cache document titles
        const docTitleCache = new Map();
        for (const item of topChunks) {
            const { chunk } = item;
            const tokenEst = chunk.tokenEstimate || Math.ceil(chunk.text.length / 4);
            if (currentTokens + tokenEst > maxTokens && evidenceInputs.length > 0) {
                break;
            }
            let docTitle = docTitleCache.get(chunk.documentId);
            if (!docTitle) {
                const doc = await this.docRepo.findById(chunk.documentId);
                docTitle = doc ? doc.title : 'Unknown Document';
                docTitleCache.set(chunk.documentId, docTitle);
            }
            // Find claims linked to this chunk
            const relevantClaims = connectedClaims.filter((cl) => cl.evidence.toLowerCase().includes(chunk.text.slice(0, 30).toLowerCase()));
            const graphContext = relevantClaims.length > 0
                ? relevantClaims.map((c) => `(${c.subject}) -[${c.predicate}]-> (${c.object})`).join('; ')
                : undefined;
            evidenceInputs.push({
                evidenceId: chunk.id,
                documentTitle: docTitle,
                chunkText: chunk.text,
                graphContext,
            });
            currentTokens += tokenEst;
        }
        return {
            evidence: evidenceInputs,
            matchedEntities,
            connectedClaims,
            totalCandidates: candidateChunks.length,
        };
    }
    extractQueryKeywords(query) {
        const stopWords = new Set([
            'the', 'is', 'at', 'which', 'on', 'a', 'an', 'in', 'and', 'or', 'of', 'for', 'to',
            'with', 'about', 'what', 'how', 'when', 'where', 'who', 'why', 'can', 'does', 'do',
            'are', 'was', 'were', 'tell', 'me', 'explain', 'show', 'list'
        ]);
        const words = query
            .replace(/[^\w\s-]/g, ' ')
            .split(/\s+/)
            .map((w) => w.trim())
            .filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()));
        // Also extract capitalized sequences / phrases
        const capitalizedMatches = query.match(/\b[A-Z][a-zA-Z0-9_.-]+(?:\s+[A-Z][a-zA-Z0-9_.-]+)*\b/g) || [];
        const combined = Array.from(new Set([...capitalizedMatches, ...words]));
        return combined.slice(0, 10);
    }
}
exports.RetrievalService = RetrievalService;
