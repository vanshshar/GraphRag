import { Router, type Request, type Response } from 'express';
import { verifyNeo4jConnectivity } from '../repositories/neo4j.driver.js';
import type { ILlmProvider } from '../providers/llm/types.js';
import type { IEmbeddingProvider } from '../providers/embeddings/types.js';

export function createHealthRouter(
  llmProvider: ILlmProvider,
  embeddingProvider: IEmbeddingProvider
): Router {
  const router = Router();

  // Process Liveness
  router.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Dependency Readiness
  router.get('/ready', async (_req: Request, res: Response) => {
    const [neo4jReady, llmHealth, embHealth] = await Promise.all([
      verifyNeo4jConnectivity().catch(() => false),
      llmProvider.healthCheck().catch((err) => ({ ok: false, message: err.message })),
      embeddingProvider.healthCheck().catch((err) => ({ ok: false, message: err.message })),
    ]);

    const isReady = neo4jReady && embHealth.ok;

    const payload = {
      status: isReady ? 'ready' : 'degraded',
      dependencies: {
        neo4j: { ready: neo4jReady },
        llm: { ready: llmHealth.ok, provider: llmProvider.providerName, model: llmProvider.modelName, note: llmHealth.message },
        embeddings: { ready: embHealth.ok, provider: embeddingProvider.providerName, model: embeddingProvider.modelName },
      },
      timestamp: new Date().toISOString(),
    };

    if (isReady) {
      res.status(200).json(payload);
    } else {
      res.status(503).json(payload);
    }
  });

  return router;
}

