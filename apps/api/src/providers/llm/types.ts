import type { ExtractionResult } from '../../schemas/extraction.schema.js';
import type { LlmAnswerResponse } from '../../schemas/chat.schema.js';

export interface GroundedEvidenceInput {
  evidenceId: string;
  documentTitle: string;
  chunkText: string;
  graphContext?: string;
}

export interface ILlmProvider {
  readonly providerName: string;
  readonly modelName: string;

  /**
   * Performs structured entity and claim extraction on a document chunk.
   */
  extractEntitiesAndClaims(chunkText: string): Promise<ExtractionResult>;

  /**
   * Generates a grounded answer to a user query given retrieved context passages.
   */
  generateGroundedAnswer(
    question: string,
    evidence: GroundedEvidenceInput[]
  ): Promise<LlmAnswerResponse>;

  /**
   * Checks if the LLM provider is configured and accessible.
   */
  healthCheck(): Promise<{ ok: boolean; message?: string }>;
}

