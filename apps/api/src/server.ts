import { createApp } from './app.js';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import {
  getNeo4jDriver,
  verifyNeo4jConnectivity,
  initializeNeo4jSchema,
  closeNeo4jDriver,
} from './repositories/neo4j.driver.js';
import { Neo4jDocumentRepository } from './repositories/neo4j.document.repository.js';
import { Neo4jGraphRepository } from './repositories/neo4j.graph.repository.js';
import { InMemoryDocumentRepository, InMemoryGraphRepository } from './repositories/memory.repository.js';
import { GroqProvider } from './providers/llm/groq.provider.js';
import { MockLlmProvider } from './providers/llm/mock.provider.js';
import { LocalMiniLmEmbeddingProvider } from './providers/embeddings/local.provider.js';
import { MockEmbeddingProvider } from './providers/embeddings/mock.provider.js';

async function bootstrap() {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Starting GraphRAG API server...');

  // Setup Providers
  const llmProvider =
    config.GROQ_API_KEY && config.GROQ_API_KEY.trim().length > 0
      ? new GroqProvider({ apiKey: config.GROQ_API_KEY, model: config.GROQ_MODEL })
      : new MockLlmProvider();

  const embeddingProvider =
    config.EMBEDDING_PROVIDER === 'mock'
      ? new MockEmbeddingProvider()
      : new LocalMiniLmEmbeddingProvider();

  // Setup Repositories
  let documentRepo;
  let graphRepo;

  const neo4jConnected = await verifyNeo4jConnectivity();
  if (neo4jConnected) {
    logger.info('Neo4j database connected. Initializing schema constraints...');
    const driver = getNeo4jDriver();
    await initializeNeo4jSchema();
    documentRepo = new Neo4jDocumentRepository(driver);
    graphRepo = new Neo4jGraphRepository(driver);
  } else {
    logger.warn('Neo4j is not reachable. Falling back to persistent in-memory repository for local development.');
    documentRepo = new InMemoryDocumentRepository();
    graphRepo = new InMemoryGraphRepository();
  }

  const app = createApp({
    llmProvider,
    embeddingProvider,
    documentRepo,
    graphRepo,
  });

  const server = app.listen(config.PORT, () => {
    logger.info(`Server is running at http://localhost:${config.PORT}`);
    logger.info(`Health check: http://localhost:${config.PORT}/health/live`);
    logger.info(`Readiness check: http://localhost:${config.PORT}/health/ready`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Graceful shutdown initiated');
    server.close(async () => {
      logger.info('HTTP server closed');
      await closeNeo4jDriver();
      logger.info('Process terminated cleanly');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forcefully terminating process due to shutdown timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal error during server bootstrap');
  process.exit(1);
});

