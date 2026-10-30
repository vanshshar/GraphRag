"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNeo4jDriver = getNeo4jDriver;
exports.verifyNeo4jConnectivity = verifyNeo4jConnectivity;
exports.initializeNeo4jSchema = initializeNeo4jSchema;
exports.closeNeo4jDriver = closeNeo4jDriver;
const neo4j_driver_1 = __importDefault(require("neo4j-driver"));
const env_js_1 = require("../config/env.js");
const logger_js_1 = require("../utils/logger.js");
let driverInstance = null;
function getNeo4jDriver() {
    if (!driverInstance) {
        logger_js_1.logger.info({ uri: env_js_1.config.NEO4J_URI }, 'Initializing Neo4j driver');
        driverInstance = neo4j_driver_1.default.driver(env_js_1.config.NEO4J_URI, neo4j_driver_1.default.auth.basic(env_js_1.config.NEO4J_USERNAME, env_js_1.config.NEO4J_PASSWORD), {
            maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
            maxConnectionPoolSize: 50,
            connectionAcquisitionTimeout: 10000, // 10 seconds
            logging: {
                level: 'warn',
                logger: (level, message) => {
                    if (level === 'error')
                        logger_js_1.logger.error({ message }, 'Neo4j driver error');
                },
            },
        });
    }
    return driverInstance;
}
async function verifyNeo4jConnectivity() {
    let session = null;
    try {
        const driver = getNeo4jDriver();
        session = driver.session({ database: env_js_1.config.NEO4J_DATABASE });
        const result = await session.run('RETURN 1 AS ping');
        return result.records.length > 0 && result.records[0].get('ping').toNumber() === 1;
    }
    catch (err) {
        logger_js_1.logger.warn({ error: err.message }, 'Neo4j connectivity check failed');
        return false;
    }
    finally {
        if (session) {
            await session.close();
        }
    }
}
async function initializeNeo4jSchema() {
    const driver = getNeo4jDriver();
    const session = driver.session({ database: env_js_1.config.NEO4J_DATABASE });
    try {
        logger_js_1.logger.info('Ensuring Neo4j uniqueness constraints and indexes...');
        const statements = [
            // Uniqueness constraints
            'CREATE CONSTRAINT doc_id_unique IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE',
            'CREATE CONSTRAINT chunk_id_unique IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE',
            'CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE',
            'CREATE CONSTRAINT claim_id_unique IF NOT EXISTS FOR (cl:Claim) REQUIRE cl.id IS UNIQUE',
            // Lookup and search indexes
            'CREATE INDEX entity_normalized_name_idx IF NOT EXISTS FOR (e:Entity) ON (e.normalizedName)',
            'CREATE INDEX entity_canonical_name_idx IF NOT EXISTS FOR (e:Entity) ON (e.canonicalName)',
            'CREATE INDEX doc_status_idx IF NOT EXISTS FOR (d:Document) ON (d.status)',
            'CREATE INDEX chunk_doc_id_idx IF NOT EXISTS FOR (c:Chunk) ON (c.documentId)',
        ];
        for (const query of statements) {
            try {
                await session.run(query);
            }
            catch (err) {
                logger_js_1.logger.warn({ query, error: err.message }, 'Notice when creating index or constraint');
            }
        }
        logger_js_1.logger.info('Neo4j constraints and indexes successfully verified');
    }
    finally {
        await session.close();
    }
}
async function closeNeo4jDriver() {
    if (driverInstance) {
        logger_js_1.logger.info('Closing Neo4j driver');
        await driverInstance.close();
        driverInstance = null;
    }
}
