"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHealthRouter = createHealthRouter;
const express_1 = require("express");
const neo4j_driver_js_1 = require("../repositories/neo4j.driver.js");
function createHealthRouter(llmProvider, embeddingProvider) {
    const router = (0, express_1.Router)();
    // Process Liveness
    router.get('/live', (_req, res) => {
        res.status(200).json({
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        });
    });
    // Dependency Readiness
    router.get('/ready', async (_req, res) => {
        const [neo4jReady, llmHealth, embHealth] = await Promise.all([
            (0, neo4j_driver_js_1.verifyNeo4jConnectivity)().catch(() => false),
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
        }
        else {
            res.status(503).json(payload);
        }
    });
    return router;
}
