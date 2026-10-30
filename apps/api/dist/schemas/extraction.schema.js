"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractionResultSchema = exports.extractedClaimSchema = exports.extractedEntitySchema = void 0;
const zod_1 = require("zod");
exports.extractedEntitySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Entity name must not be empty').max(200),
    type: zod_1.z.string().min(1).default('Concept'),
    aliases: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.extractedClaimSchema = zod_1.z.object({
    subject: zod_1.z.string().min(1, 'Subject must not be empty').max(200),
    predicate: zod_1.z
        .string()
        .min(1, 'Predicate must not be empty')
        .max(100)
        .transform((val) => val.trim().toUpperCase().replace(/[\s-]+/g, '_')),
    object: zod_1.z.string().min(1, 'Object must not be empty').max(200),
    evidence: zod_1.z.string().min(3, 'Evidence passage must not be empty'),
    confidence: zod_1.z.number().min(0).max(1).default(0.8),
});
exports.extractionResultSchema = zod_1.z.object({
    entities: zod_1.z.array(exports.extractedEntitySchema).default([]),
    claims: zod_1.z.array(exports.extractedClaimSchema).default([]),
});
