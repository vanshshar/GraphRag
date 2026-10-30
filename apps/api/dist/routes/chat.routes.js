"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChatRouter = createChatRouter;
const express_1 = require("express");
const validate_js_1 = require("../middleware/validate.js");
const chat_schema_js_1 = require("../schemas/chat.schema.js");
function createChatRouter(answeringService) {
    const router = (0, express_1.Router)();
    // POST /api/v1/chat/query
    router.post('/query', (0, validate_js_1.validateBody)(chat_schema_js_1.chatQueryRequestSchema), async (req, res, next) => {
        try {
            const { question, topK, maxHops } = req.body;
            const result = await answeringService.answerQuestion(question, req.id, {
                topK,
                maxHops,
            });
            res.status(200).json(result);
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
