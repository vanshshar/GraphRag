import { z } from 'zod';

export const extractedEntitySchema = z.object({
  name: z.string().min(1, 'Entity name must not be empty').max(200),
  type: z.string().min(1).default('Concept'),
  aliases: z.array(z.string()).default([]),
});

export const extractedClaimSchema = z.object({
  subject: z.string().min(1, 'Subject must not be empty').max(200),
  predicate: z
    .string()
    .min(1, 'Predicate must not be empty')
    .max(100)
    .transform((val) => val.trim().toUpperCase().replace(/[\s-]+/g, '_')),
  object: z.string().min(1, 'Object must not be empty').max(200),
  evidence: z.string().min(3, 'Evidence passage must not be empty'),
  confidence: z.number().min(0).max(1).default(0.8),
});

export const extractionResultSchema = z.object({
  entities: z.array(extractedEntitySchema).default([]),
  claims: z.array(extractedClaimSchema).default([]),
});

export type ExtractedEntity = z.infer<typeof extractedEntitySchema>;
export type ExtractedClaim = z.infer<typeof extractedClaimSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

