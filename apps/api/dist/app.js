"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_js_1 = require("./config/env.js");
const requestId_js_1 = require("./middleware/requestId.js");
const errorHandler_js_1 = require("./middleware/errorHandler.js");
const health_routes_js_1 = require("./routes/health.routes.js");
const document_routes_js_1 = require("./routes/document.routes.js");
const chat_routes_js_1 = require("./routes/chat.routes.js");
const graph_routes_js_1 = require("./routes/graph.routes.js");
const ingestion_service_js_1 = require("./services/ingestion.service.js");
const retrieval_service_js_1 = require("./services/retrieval.service.js");
const answering_service_js_1 = require("./services/answering.service.js");
function createApp(dependencies) {
    const app = (0, express_1.default)();
    // CORS configuration
    app.use((0, cors_1.default)({
        origin: [env_js_1.config.WEB_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    }));
    // Request ID
    app.use(requestId_js_1.requestIdMiddleware);
    // Body parser with size limits
    app.use(express_1.default.json({ limit: `${env_js_1.config.MAX_UPLOAD_MB}mb` }));
    app.use(express_1.default.urlencoded({ extended: true, limit: `${env_js_1.config.MAX_UPLOAD_MB}mb` }));
    // Services instantiation
    const ingestionService = new ingestion_service_js_1.IngestionService(dependencies.documentRepo, dependencies.graphRepo, dependencies.llmProvider, dependencies.embeddingProvider, {
        chunkSize: env_js_1.config.CHUNK_SIZE,
        chunkOverlap: env_js_1.config.CHUNK_OVERLAP,
    });
    const retrievalService = new retrieval_service_js_1.RetrievalService(dependencies.graphRepo, dependencies.documentRepo, dependencies.embeddingProvider);
    const answeringService = new answering_service_js_1.AnsweringService(retrievalService, dependencies.llmProvider, dependencies.graphRepo);
    // Health endpoints
    app.use('/health', (0, health_routes_js_1.createHealthRouter)(dependencies.llmProvider, dependencies.embeddingProvider));
    // Versioned API v1
    app.use('/api/v1/documents', (0, document_routes_js_1.createDocumentRouter)(ingestionService, dependencies.documentRepo, dependencies.graphRepo));
    app.use('/api/v1/chat', (0, chat_routes_js_1.createChatRouter)(answeringService));
    app.use('/api/v1/graph', (0, graph_routes_js_1.createGraphRouter)(dependencies.graphRepo));
    // Centralized Error Handler
    app.use(errorHandler_js_1.errorHandler);
    return app;
}
