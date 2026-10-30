"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphStatsSchema = exports.claimNodeSchema = exports.entityNodeSchema = void 0;
const zod_1 = require("zod");
exports.entityNodeSchema = zod_1.z.object({
    id: zod_1.z.string(),
    canonicalName: zod_1.z.string(),
    normalizedName: zod_1.z.string(),
    type: zod_1.z.string(),
    aliases: zod_1.z.array(zod_1.z.string()).default([]),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
exports.claimNodeSchema = zod_1.z.object({
    id: zod_1.z.string(),
    subject: zod_1.z.string(),
    predicate: zod_1.z.string(),
    object: zod_1.z.string(),
    evidence: zod_1.z.string(),
    confidence: zod_1.z.number().optional(),
    extractionVersion: zod_1.z.string().optional(),
});
exports.graphStatsSchema = zod_1.z.object({
    documentCount: zod_1.z.number().int().nonnegative(),
    chunkCount: zod_1.z.number().int().nonnegative(),
    entityCount: zod_1.z.number().int().nonnegative(),
    claimCount: zod_1.z.number().int().nonnegative(),
});
