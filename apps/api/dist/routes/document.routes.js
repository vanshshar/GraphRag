"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDocumentRouter = createDocumentRouter;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const env_js_1 = require("../config/env.js");
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const validate_js_1 = require("../middleware/validate.js");
const document_schema_js_1 = require("../schemas/document.schema.js");
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: env_js_1.config.MAX_UPLOAD_MB * 1024 * 1024,
    },
});
function createDocumentRouter(ingestionService, docRepo, graphRepo) {
    const router = (0, express_1.Router)();
    // Upload Document
    router.post('/', upload.single('file'), async (req, res, next) => {
        try {
            const file = req.file;
            let buffer;
            let filename;
            let mimeType;
            if (file) {
                buffer = file.buffer;
                filename = file.originalname;
                mimeType = file.mimetype;
            }
            else if (req.body && req.body.text && typeof req.body.text === 'string') {
                // Allow raw text ingestion
                buffer = Buffer.from(req.body.text, 'utf-8');
                filename = req.body.title ? `${req.body.title}.txt` : 'document.txt';
                mimeType = 'text/plain';
            }
            else {
                throw new errorHandler_js_1.ValidationError('A file or text payload must be provided.');
            }
            const document = await ingestionService.processDocument(buffer, filename, mimeType, req.id);
            res.status(201).json({
                documentId: document.id,
                title: document.title,
                status: document.status,
                chunkCount: document.chunkCount,
                createdAt: document.createdAt,
            });
        }
        catch (err) {
            next(err);
        }
    });
    // List Documents (Paginated)
    router.get('/', (0, validate_js_1.validateQuery)(document_schema_js_1.documentListQuerySchema), async (req, res, next) => {
        try {
            const page = Number(req.query.page || 1);
            const limit = Number(req.query.limit || 20);
            const status = req.query.status;
            const search = req.query.search;
            const result = await docRepo.list({ page, limit, status, search });
            res.status(200).json({
                documents: result.documents,
                pagination: {
                    page,
                    limit,
                    total: result.total,
                    totalPages: Math.ceil(result.total / limit),
                },
            });
        }
        catch (err) {
            next(err);
        }
    });
    // Get Document Details
    router.get('/:id', async (req, res, next) => {
        try {
            const doc = await docRepo.findById(req.params.id);
            if (!doc) {
                throw new errorHandler_js_1.NotFoundError(`Document with ID "${req.params.id}" not found.`);
            }
            res.status(200).json({ document: doc });
        }
        catch (err) {
            next(err);
        }
    });
    // Delete Document (Safe Deletion)
    router.delete('/:id', async (req, res, next) => {
        try {
            const id = req.params.id;
            const doc = await docRepo.findById(id);
            if (!doc) {
                throw new errorHandler_js_1.NotFoundError(`Document with ID "${id}" not found.`);
            }
            // 1. Delete document's graph elements safely without destroying shared entities
            await graphRepo.safeDeleteDocumentGraph(id);
            // 2. Delete document record
            await docRepo.delete(id);
            res.status(204).send();
        }
        catch (err) {
            next(err);
        }
    });
    // Reprocess Document
    router.post('/:id/reprocess', async (req, res, next) => {
        try {
            const doc = await ingestionService.reprocessDocument(req.params.id, req.id);
            res.status(200).json({
                documentId: doc.id,
                status: doc.status,
                message: 'Document scheduled for reprocessing.',
            });
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
