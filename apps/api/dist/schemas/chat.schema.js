"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmAnswerResponseSchema = exports.chatQueryResponseSchema = exports.citationItemSchema = exports.chatQueryRequestSchema = void 0;
const zod_1 = require("zod");
exports.chatQueryRequestSchema = zod_1.z.object({
    question: zod_1.z.string().min(1, 'Question must not be empty').max(2000, 'Question too long'),
    topK: zod_1.z.number().int().positive().max(20).optional(),
    maxHops: zod_1.z.number().int().positive().max(4).optional(),
});
exports.citationItemSchema = zod_1.z.object({
    evidenceId: zod_1.z.string(),
    quote: zod_1.z.string(),
    documentId: zod_1.z.string().optional(),
    documentTitle: zod_1.z.string().optional(),
    chunkId: zod_1.z.string().optional(),
    pageNumber: zod_1.z.number().nullable().optional(),
    section: zod_1.z.string().nullable().optional(),
});
exports.chatQueryResponseSchema = zod_1.z.object({
    answer: zod_1.z.string(),
    citations: zod_1.z.array(exports.citationItemSchema),
    insufficientEvidence: zod_1.z.boolean(),
    requestId: zod_1.z.string(),
    timingMs: zod_1.z.number().optional(),
    retrievedCount: zod_1.z.number().optional(),
});
/**
 * Structured LLM answer extraction schema
 */
exports.llmAnswerResponseSchema = zod_1.z.object({
    answer: zod_1.z.string(),
    citations: zod_1.z
        .array(zod_1.z.object({
        evidenceId: zod_1.z.string(),
        quote: zod_1.z.string(),
    }))
        .default([]),
    insufficientEvidence: zod_1.z.boolean().default(false),
});
