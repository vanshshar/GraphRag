import { z } from 'zod';

export const entityNodeSchema = z.object({
  id: z.string(),
  canonicalName: z.string(),
  normalizedName: z.string(),
  type: z.string(),
  aliases: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type EntityNode = z.infer<typeof entityNodeSchema>;

export const claimNodeSchema = z.object({
  id: z.string(),
  subject: z.string(),
  predicate: z.string(),
  object: z.string(),
  evidence: z.string(),
  confidence: z.number().optional(),
  extractionVersion: z.string().optional(),
});

export type ClaimNode = z.infer<typeof claimNodeSchema>;

export const graphStatsSchema = z.object({
  documentCount: z.number().int().nonnegative(),
  chunkCount: z.number().int().nonnegative(),
  entityCount: z.number().int().nonnegative(),
  claimCount: z.number().int().nonnegative(),
});

export type GraphStats = z.infer<typeof graphStatsSchema>;

