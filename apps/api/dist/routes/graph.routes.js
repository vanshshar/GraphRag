"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGraphRouter = createGraphRouter;
const express_1 = require("express");
function createGraphRouter(graphRepo) {
    const router = (0, express_1.Router)();
    // GET /api/v1/graph/stats
    router.get('/stats', async (_req, res, next) => {
        try {
            const stats = await graphRepo.getStats();
            res.status(200).json({ stats });
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
