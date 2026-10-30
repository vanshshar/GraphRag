"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256 = sha256;
exports.generateId = generateId;
exports.generateDeterministicId = generateDeterministicId;
const node_crypto_1 = __importDefault(require("node:crypto"));
const uuid_1 = require("uuid");
/**
 * Computes a SHA-256 hex hash of the given string or Buffer.
 */
function sha256(content) {
    return node_crypto_1.default.createHash('sha256').update(content).digest('hex');
}
/**
 * Generates a random UUID v4.
 */
function generateId() {
    return (0, uuid_1.v4)();
}
/**
 * Generates a deterministic canonical ID from a namespace and a key.
 * Used for entity canonical ID (e.g. "entity:technology:nodejs")
 */
function generateDeterministicId(namespace, key) {
    const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_');
    const hash = node_crypto_1.default.createHash('sha256').update(`${namespace}:${normalizedKey}`).digest('hex').substring(0, 16);
    return `${namespace}_${hash}`;
}
