import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { config } from '../config/env.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { validateQuery } from '../middleware/validate.js';
import { documentListQuerySchema } from '../schemas/document.schema.js';
import type { IngestionService } from '../services/ingestion.service.js';
import type { IDocumentRepository, IGraphRepository } from '../repositories/types.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.MAX_UPLOAD_MB * 1024 * 1024,
  },
});

export function createDocumentRouter(
  ingestionService: IngestionService,
  docRepo: IDocumentRepository,
  graphRepo: IGraphRepository
): Router {
  const router = Router();

  // Upload Document
  router.post(
    '/',
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const file = req.file;
        let buffer: Buffer;
        let filename: string;
        let mimeType: string;

        if (file) {
          buffer = file.buffer;
          filename = file.originalname;
          mimeType = file.mimetype;
        } else if (req.body && req.body.text && typeof req.body.text === 'string') {
          // Allow raw text ingestion
          buffer = Buffer.from(req.body.text, 'utf-8');
          filename = req.body.title ? `${req.body.title}.txt` : 'document.txt';
          mimeType = 'text/plain';
        } else {
          throw new ValidationError('A file or text payload must be provided.');
        }

        const document = await ingestionService.processDocument(
          buffer,
          filename,
          mimeType,
          req.id
        );

        res.status(201).json({
          documentId: document.id,
          title: document.title,
          status: document.status,
          chunkCount: document.chunkCount,
          createdAt: document.createdAt,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // List Documents (Paginated)
  router.get(
    '/',
    validateQuery(documentListQuerySchema),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);
        const status = req.query.status as any;
        const search = req.query.search as string | undefined;

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
      } catch (err) {
        next(err);
      }
    }
  );

  // Get Document Details
  router.get(
    '/:id',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const doc = await docRepo.findById(req.params.id);
        if (!doc) {
          throw new NotFoundError(`Document with ID "${req.params.id}" not found.`);
        }
        res.status(200).json({ document: doc });
      } catch (err) {
        next(err);
      }
    }
  );

  // Delete Document (Safe Deletion)
  router.delete(
    '/:id',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = req.params.id;
        const doc = await docRepo.findById(id);
        if (!doc) {
          throw new NotFoundError(`Document with ID "${id}" not found.`);
        }

        // 1. Delete document's graph elements safely without destroying shared entities
        await graphRepo.safeDeleteDocumentGraph(id);

        // 2. Delete document record
        await docRepo.delete(id);

        res.status(204).send();
      } catch (err) {
        next(err);
      }
    }
  );

  // Reprocess Document
  router.post(
    '/:id/reprocess',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const doc = await ingestionService.reprocessDocument(req.params.id, req.id);
        res.status(200).json({
          documentId: doc.id,
          status: doc.status,
          message: 'Document scheduled for reprocessing.',
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

