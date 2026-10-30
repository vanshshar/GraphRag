import { z } from 'zod';

export const documentStatusSchema = z.enum(['queued', 'processing', 'completed', 'failed']);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

export const documentModelSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  originalFilename: z.string(),
  mimeType: z.string(),
  fileSize: z.number().int().nonnegative(),
  contentHash: z.string(),
  status: documentStatusSchema,
  chunkCount: z.number().int().nonnegative().default(0),
  errorCode: z.string().optional().nullable(),
  errorMessage: z.string().optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DocumentModel = z.infer<typeof documentModelSchema>;

export const chunkModelSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  index: z.number().int().nonnegative(),
  text: z.string(),
  tokenEstimate: z.number().int().default(0),
  pageNumber: z.number().int().optional().nullable(),
  section: z.string().optional().nullable(),
  contentHash: z.string(),
  embedding: z.array(z.number()).optional(),
});

export type ChunkModel = z.infer<typeof chunkModelSchema>;

export const uploadDocumentResponseSchema = z.object({
  documentId: z.string(),
  status: documentStatusSchema,
  message: z.string(),
});

export const documentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: documentStatusSchema.optional(),
  search: z.string().optional(),
});

