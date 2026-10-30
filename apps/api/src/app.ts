import express, { type Express } from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createHealthRouter } from './routes/health.routes.js';
import { createDocumentRouter } from './routes/document.routes.js';
import { createChatRouter } from './routes/chat.routes.js';
import { createGraphRouter } from './routes/graph.routes.js';

import type { ILlmProvider } from './providers/llm/types.js';
import type { IEmbeddingProvider } from './providers/embeddings/types.js';
import type { IDocumentRepository, IGraphRepository } from './repositories/types.js';
import { IngestionService } from './services/ingestion.service.js';
import { RetrievalService } from './services/retrieval.service.js';
import { AnsweringService } from './services/answering.service.js';

export interface AppDependencies {
  llmProvider: ILlmProvider;
  embeddingProvider: IEmbeddingProvider;
  documentRepo: IDocumentRepository;
  graphRepo: IGraphRepository;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();

  // CORS configuration
  app.use(
    cors({
      origin: [config.WEB_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    })
  );

  // Request ID
  app.use(requestIdMiddleware);

  // Body parser with size limits
  app.use(express.json({ limit: `${config.MAX_UPLOAD_MB}mb` }));
  app.use(express.urlencoded({ extended: true, limit: `${config.MAX_UPLOAD_MB}mb` }));

  // Services instantiation
  const ingestionService = new IngestionService(
    dependencies.documentRepo,
    dependencies.graphRepo,
    dependencies.llmProvider,
    dependencies.embeddingProvider,
    {
      chunkSize: config.CHUNK_SIZE,
      chunkOverlap: config.CHUNK_OVERLAP,
    }
  );

  const retrievalService = new RetrievalService(
    dependencies.graphRepo,
    dependencies.documentRepo,
    dependencies.embeddingProvider
  );

  const answeringService = new AnsweringService(
    retrievalService,
    dependencies.llmProvider,
    dependencies.graphRepo
  );

  // Health endpoints
  app.use(
    '/health',
    createHealthRouter(dependencies.llmProvider, dependencies.embeddingProvider)
  );

  // Versioned API v1
  app.use(
    '/api/v1/documents',
    createDocumentRouter(ingestionService, dependencies.documentRepo, dependencies.graphRepo)
  );
  app.use('/api/v1/chat', createChatRouter(answeringService));
  app.use('/api/v1/graph', createGraphRouter(dependencies.graphRepo));

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
