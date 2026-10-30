import type { ILlmProvider } from '../providers/llm/types.js';
import type { RetrievalService } from './retrieval.service.js';
import type { IGraphRepository } from '../repositories/types.js';
import type { ChatQueryResponse, CitationItem } from '../schemas/chat.schema.js';
import { logger } from '../utils/logger.js';

export class AnsweringService {
  constructor(
    private retrievalService: RetrievalService,
    private llmProvider: ILlmProvider,
    private graphRepo: IGraphRepository
  ) {}

  public async answerQuestion(
    question: string,
    requestId: string,
    options: { topK?: number; maxHops?: number } = {}
  ): Promise<ChatQueryResponse> {
    const startTime = Date.now();
    logger.info({ question, requestId }, 'Processing grounded question answering');

    // 1. Retrieve hybrid evidence
    const retrievalResult = await this.retrievalService.retrieve(question, {
      topK: options.topK,
      maxHops: options.maxHops,
    });

    const { evidence } = retrievalResult;

    // Handle case where no evidence could be retrieved at all
    if (evidence.length === 0) {
      logger.info({ requestId }, 'No relevant evidence found for query');
      return {
        answer:
          'I could not find any relevant information in the uploaded documents to answer your question.',
        citations: [],
        insufficientEvidence: true,
        requestId,
        timingMs: Date.now() - startTime,
        retrievedCount: 0,
      };
    }

    // 2. Generate grounded answer via LLM
    const llmResult = await this.llmProvider.generateGroundedAnswer(question, evidence);

    // 3. SERVER-SIDE CITATION VERIFICATION
    // Build trusted evidence lookup table
    const evidenceMap = new Map<string, { documentTitle: string; chunkText: string }>();
    for (const ev of evidence) {
      evidenceMap.set(ev.evidenceId, {
        documentTitle: ev.documentTitle,
        chunkText: ev.chunkText,
      });
    }

    // Also fetch chunks to resolve chunk metadata
    const chunkIds = evidence.map((e) => e.evidenceId);
    const chunkModels = await this.graphRepo.getChunksByIds(chunkIds);
    const chunkDetailsMap = new Map<string, { documentId: string; pageNumber?: number | null; section?: string | null }>();
    for (const cm of chunkModels) {
      chunkDetailsMap.set(cm.id, {
        documentId: cm.documentId,
        pageNumber: cm.pageNumber,
        section: cm.section,
      });
    }

    const verifiedCitations: CitationItem[] = [];

    for (const modelCitation of llmResult.citations) {
      // Must match an evidence ID actually supplied in this specific retrieval
      const trustedSource = evidenceMap.get(modelCitation.evidenceId);
      if (!trustedSource) {
        logger.warn(
          { modelCitationId: modelCitation.evidenceId, requestId },
          'Discarding model-fabricated citation ID that was not in retrieved evidence'
        );
        continue;
      }

      const chunkDetails = chunkDetailsMap.get(modelCitation.evidenceId);

      // Verify that the quote or excerpt is relevant to the source chunk
      let verifiedQuote = modelCitation.quote.trim();
      if (!trustedSource.chunkText.toLowerCase().includes(verifiedQuote.toLowerCase().slice(0, 30))) {
        // If LLM modified quote, provide the reliable source excerpt
        verifiedQuote = trustedSource.chunkText.slice(0, 160) + '...';
      }

      verifiedCitations.push({
        evidenceId: modelCitation.evidenceId,
        quote: verifiedQuote,
        chunkId: modelCitation.evidenceId,
        documentTitle: trustedSource.documentTitle,
        documentId: chunkDetails?.documentId,
        pageNumber: chunkDetails?.pageNumber,
        section: chunkDetails?.section,
      });
    }

    const timingMs = Date.now() - startTime;
    logger.info(
      {
        requestId,
        verifiedCitationsCount: verifiedCitations.length,
        insufficientEvidence: llmResult.insufficientEvidence,
        timingMs,
      },
      'Grounded answer generated and citations verified'
    );

    return {
      answer: llmResult.answer,
      citations: verifiedCitations,
      insufficientEvidence: llmResult.insufficientEvidence,
      requestId,
      timingMs,
      retrievedCount: evidence.length,
    };
  }
}
