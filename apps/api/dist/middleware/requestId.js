"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = requestIdMiddleware;
const uuid_1 = require("uuid");
function requestIdMiddleware(req, res, next) {
    const existingId = req.headers['x-request-id'];
    const requestId = typeof existingId === 'string' && existingId.trim().length > 0
        ? existingId.trim()
        : (0, uuid_1.v4)();
    req.id = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
}
