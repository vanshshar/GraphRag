import { describe, it, expect } from 'vitest';
import { extractionResultSchema } from '../../src/schemas/extraction.schema.js';
import { chatQueryRequestSchema, llmAnswerResponseSchema } from '../../src/schemas/chat.schema.js';

describe('Zod Validation Schemas', () => {
  describe('extractionResultSchema', () => {
    it('validates a compliant extraction payload', () => {
      const payload = {
        entities: [
          { name: 'Node.js', type: 'Technology', aliases: ['Node'] },
        ],
        claims: [
          {
            subject: 'Express.js',
            predicate: 'built on',
            object: 'Node.js',
            evidence: 'Express.js is built on Node.js.',
            confidence: 0.95,
          },
        ],
      };

      const parsed = extractionResultSchema.parse(payload);
      expect(parsed.entities).toHaveLength(1);
      expect(parsed.claims).toHaveLength(1);
      // Verify predicate transformation to uppercase SNAKE_CASE
      expect(parsed.claims[0].predicate).toBe('BUILT_ON');
    });

    it('rejects claim missing evidence', () => {
      const payload = {
        entities: [],
        claims: [
          {
            subject: 'A',
            predicate: 'RELATES_TO',
            object: 'B',
            evidence: '', // Empty evidence should fail validation
          },
        ],
      };

      expect(() => extractionResultSchema.parse(payload)).toThrow();
    });
  });

  describe('chatQueryRequestSchema', () => {
    it('validates query request and rejects empty question', () => {
      expect(() => chatQueryRequestSchema.parse({ question: '' })).toThrow();
      const valid = chatQueryRequestSchema.parse({ question: 'How does GraphRAG work?', topK: 5 });
      expect(valid.topK).toBe(5);
    });
  });

  describe('llmAnswerResponseSchema', () => {
    it('parses structured model answer and citation IDs', () => {
      const payload = {
        answer: 'Express is a framework built on Node.js.',
        citations: [
          { evidenceId: 'chunk_doc1_0', quote: 'Express is built on Node.js.' },
        ],
        insufficientEvidence: false,
      };

      const parsed = llmAnswerResponseSchema.parse(payload);
      expect(parsed.citations[0].evidenceId).toBe('chunk_doc1_0');
      expect(parsed.insufficientEvidence).toBe(false);
    });
  });
});

