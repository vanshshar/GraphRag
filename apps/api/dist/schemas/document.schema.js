"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentListQuerySchema = exports.uploadDocumentResponseSchema = exports.chunkModelSchema = exports.documentModelSchema = exports.documentStatusSchema = void 0;
const zod_1 = require("zod");
exports.documentStatusSchema = zod_1.z.enum(['queued', 'processing', 'completed', 'failed']);
exports.documentModelSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    title: zod_1.z.string().min(1),
    originalFilename: zod_1.z.string(),
    mimeType: zod_1.z.string(),
    fileSize: zod_1.z.number().int().nonnegative(),
    contentHash: zod_1.z.string(),
    status: exports.documentStatusSchema,
    chunkCount: zod_1.z.number().int().nonnegative().default(0),
    errorCode: zod_1.z.string().optional().nullable(),
    errorMessage: zod_1.z.string().optional().nullable(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
exports.chunkModelSchema = zod_1.z.object({
    id: zod_1.z.string(),
    documentId: zod_1.z.string(),
    index: zod_1.z.number().int().nonnegative(),
    text: zod_1.z.string(),
    tokenEstimate: zod_1.z.number().int().default(0),
    pageNumber: zod_1.z.number().int().optional().nullable(),
    section: zod_1.z.string().optional().nullable(),
    contentHash: zod_1.z.string(),
    embedding: zod_1.z.array(zod_1.z.number()).optional(),
});
exports.uploadDocumentResponseSchema = zod_1.z.object({
    documentId: zod_1.z.string(),
    status: exports.documentStatusSchema,
    message: zod_1.z.string(),
});
exports.documentListQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    status: exports.documentStatusSchema.optional(),
    search: zod_1.z.string().optional(),
});
