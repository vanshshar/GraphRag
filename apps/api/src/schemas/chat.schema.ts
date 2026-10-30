import { z } from 'zod';

export const chatQueryRequestSchema = z.object({
  question: z.string().min(1, 'Question must not be empty').max(2000, 'Question too long'),
  topK: z.number().int().positive().max(20).optional(),
  maxHops: z.number().int().positive().max(4).optional(),
});

export type ChatQueryRequest = z.infer<typeof chatQueryRequestSchema>;

export const citationItemSchema = z.object({
  evidenceId: z.string(),
  quote: z.string(),
  documentId: z.string().optional(),
  documentTitle: z.string().optional(),
  chunkId: z.string().optional(),
  pageNumber: z.number().nullable().optional(),
  section: z.string().nullable().optional(),
});

export type CitationItem = z.infer<typeof citationItemSchema>;

export const chatQueryResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(citationItemSchema),
  insufficientEvidence: z.boolean(),
  requestId: z.string(),
  timingMs: z.number().optional(),
  retrievedCount: z.number().optional(),
});

export type ChatQueryResponse = z.infer<typeof chatQueryResponseSchema>;

/**
 * Structured LLM answer extraction schema
 */
export const llmAnswerResponseSchema = z.object({
  answer: z.string(),
  citations: z
    .array(
      z.object({
        evidenceId: z.string(),
        quote: z.string(),
      })
    )
    .default([]),
  insufficientEvidence: z.boolean().default(false),
});

export type LlmAnswerResponse = z.infer<typeof llmAnswerResponseSchema>;

