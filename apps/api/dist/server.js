"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = require("./app.js");
const env_js_1 = require("./config/env.js");
const logger_js_1 = require("./utils/logger.js");
const neo4j_driver_js_1 = require("./repositories/neo4j.driver.js");
const neo4j_document_repository_js_1 = require("./repositories/neo4j.document.repository.js");
const neo4j_graph_repository_js_1 = require("./repositories/neo4j.graph.repository.js");
const memory_repository_js_1 = require("./repositories/memory.repository.js");
const groq_provider_js_1 = require("./providers/llm/groq.provider.js");
const mock_provider_js_1 = require("./providers/llm/mock.provider.js");
const local_provider_js_1 = require("./providers/embeddings/local.provider.js");
const mock_provider_js_2 = require("./providers/embeddings/mock.provider.js");
async function bootstrap() {
    logger_js_1.logger.info({ port: env_js_1.config.PORT, env: env_js_1.config.NODE_ENV }, 'Starting GraphRAG API server...');
    // Setup Providers
    const llmProvider = env_js_1.config.GROQ_API_KEY && env_js_1.config.GROQ_API_KEY.trim().length > 0
        ? new groq_provider_js_1.GroqProvider({ apiKey: env_js_1.config.GROQ_API_KEY, model: env_js_1.config.GROQ_MODEL })
        : new mock_provider_js_1.MockLlmProvider();
    const embeddingProvider = env_js_1.config.EMBEDDING_PROVIDER === 'mock'
        ? new mock_provider_js_2.MockEmbeddingProvider()
        : new local_provider_js_1.LocalMiniLmEmbeddingProvider();
    // Setup Repositories
    let documentRepo;
    let graphRepo;
    const neo4jConnected = await (0, neo4j_driver_js_1.verifyNeo4jConnectivity)();
    if (neo4jConnected) {
        logger_js_1.logger.info('Neo4j database connected. Initializing schema constraints...');
        const driver = (0, neo4j_driver_js_1.getNeo4jDriver)();
        await (0, neo4j_driver_js_1.initializeNeo4jSchema)();
        documentRepo = new neo4j_document_repository_js_1.Neo4jDocumentRepository(driver);
        graphRepo = new neo4j_graph_repository_js_1.Neo4jGraphRepository(driver);
    }
    else {
        logger_js_1.logger.warn('Neo4j is not reachable. Falling back to persistent in-memory repository for local development.');
        documentRepo = new memory_repository_js_1.InMemoryDocumentRepository();
        graphRepo = new memory_repository_js_1.InMemoryGraphRepository();
    }
    const app = (0, app_js_1.createApp)({
        llmProvider,
        embeddingProvider,
        documentRepo,
        graphRepo,
    });
    const server = app.listen(env_js_1.config.PORT, () => {
        logger_js_1.logger.info(`Server is running at http://localhost:${env_js_1.config.PORT}`);
        logger_js_1.logger.info(`Health check: http://localhost:${env_js_1.config.PORT}/health/live`);
        logger_js_1.logger.info(`Readiness check: http://localhost:${env_js_1.config.PORT}/health/ready`);
    });
    // Graceful shutdown
    const shutdown = async (signal) => {
        logger_js_1.logger.info({ signal }, 'Graceful shutdown initiated');
        server.close(async () => {
            logger_js_1.logger.info('HTTP server closed');
            await (0, neo4j_driver_js_1.closeNeo4jDriver)();
            logger_js_1.logger.info('Process terminated cleanly');
            process.exit(0);
        });
        setTimeout(() => {
            logger_js_1.logger.error('Forcefully terminating process due to shutdown timeout');
            process.exit(1);
        }, 10000);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}
bootstrap().catch((err) => {
    logger_js_1.logger.error({ err }, 'Fatal error during server bootstrap');
    process.exit(1);
});
