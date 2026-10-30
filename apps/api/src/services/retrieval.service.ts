import { cosineSimilarity, type IEmbeddingProvider } from '../providers/embeddings/types.js';
import type { IGraphRepository, IDocumentRepository } from '../repositories/types.js';
import type { ChunkModel } from '../schemas/document.schema.js';
import type { ClaimNode, EntityNode } from '../schemas/graph.schema.js';
import type { GroundedEvidenceInput } from '../providers/llm/types.js';
import { logger } from '../utils/logger.js';

export interface RetrievalResult {
  evidence: GroundedEvidenceInput[];
  matchedEntities: EntityNode[];
  connectedClaims: ClaimNode[];
  totalCandidates: number;
}

export interface RetrievalOptions {
  topK?: number;
  maxHops?: number;
  maxContextTokens?: number;
}

export class RetrievalService {
  constructor(
    private graphRepo: IGraphRepository,
    private docRepo: IDocumentRepository,
    private embeddingProvider: IEmbeddingProvider
  ) {}

  public async retrieve(
    question: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievalResult> {
    const topK = options.topK ?? 8;
    const maxHops = options.maxHops ?? 2;
    const maxTokens = options.maxContextTokens ?? 3000;

    logger.debug({ question, topK, maxHops }, 'Starting hybrid retrieval');

    // 1. Extract query tokens and keywords
    const keywords = this.extractQueryKeywords(question);

    // 2. Exact and normalized entity lookup
    const matchedEntities = await this.graphRepo.findEntitiesByKeywords(keywords);
    const entityIds = matchedEntities.map((e) => e.id);

    // 3. Bounded Graph Traversal from matched entities
    let connectedClaims: ClaimNode[] = [];
    let graphChunkIds: string[] = [];

    if (entityIds.length > 0) {
      const traversal = await this.graphRepo.traverseGraphFromEntities(entityIds, maxHops, 25);
      connectedClaims = traversal.claims;
      graphChunkIds = traversal.supportingChunkIds;
    }

    // 4. Lexical Search
    const lexicalChunks: ChunkModel[] = [];
    for (const kw of keywords.slice(0, 5)) {
      const found = await this.graphRepo.searchChunksByKeyword(kw, 5);
      lexicalChunks.push(...found);
    }

    // 5. Semantic Vector Retrieval
    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await this.embeddingProvider.generateEmbedding(question);
    } catch (embErr: any) {
      logger.warn({ error: embErr.message }, 'Embedding generation failed during retrieval');
    }

    // Combine candidate chunks
    const candidateChunkMap = new Map<string, ChunkModel>();

    // Add chunks found via graph traversal
    if (graphChunkIds.length > 0) {
      const gChunks = await this.graphRepo.getChunksByIds(graphChunkIds);
      for (const gc of gChunks) candidateChunkMap.set(gc.id, gc);
    }

    // Add chunks found via lexical search
    for (const lc of lexicalChunks) {
      candidateChunkMap.set(lc.id, lc);
    }

    const candidateChunks = Array.from(candidateChunkMap.values());

    // 6. Candidate Ranking
    interface ScoredCandidate {
      chunk: ChunkModel;
      score: number;
    }

    const scored: ScoredCandidate[] = candidateChunks.map((chunk) => {
      // Semantic score
      let semanticScore = 0;
      if (queryEmbedding.length > 0 && chunk.embedding && chunk.embedding.length > 0) {
        semanticScore = Math.max(0, cosineSimilarity(queryEmbedding, chunk.embedding));
      }

      // Lexical overlap score
      const chunkLower = chunk.text.toLowerCase();
      let matches = 0;
      for (const kw of keywords) {
        if (chunkLower.includes(kw.toLowerCase())) matches++;
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
    const evidenceInputs: GroundedEvidenceInput[] = [];

    // Cache document titles
    const docTitleCache = new Map<string, string>();

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
      const relevantClaims = connectedClaims.filter((cl) =>
        cl.evidence.toLowerCase().includes(chunk.text.slice(0, 30).toLowerCase())
      );
      const graphContext =
        relevantClaims.length > 0
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

  private extractQueryKeywords(query: string): string[] {
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
