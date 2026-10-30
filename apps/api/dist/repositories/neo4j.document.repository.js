"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Neo4jDocumentRepository = void 0;
const env_js_1 = require("../config/env.js");
class Neo4jDocumentRepository {
    driver;
    constructor(driver) {
        this.driver = driver;
    }
    async create(doc) {
        const session = this.driver.session({ database: env_js_1.config.NEO4J_DATABASE });
        try {
            const query = `
        CREATE (d:Document {
          id: $id,
          title: $title,
          originalFilename: $originalFilename,
          mimeType: $mimeType,
          fileSize: $fileSize,
          contentHash: $contentHash,
          status: $status,
          chunkCount: $chunkCount,
          errorCode: $errorCode,
          errorMessage: $errorMessage,
          createdAt: $createdAt,
          updatedAt: $updatedAt
        })
        RETURN d
      `;
            await session.run(query, {
                id: doc.id,
                title: doc.title,
                originalFilename: doc.originalFilename,
                mimeType: doc.mimeType,
                fileSize: doc.fileSize,
                contentHash: doc.contentHash,
                status: doc.status,
                chunkCount: doc.chunkCount,
                errorCode: doc.errorCode ?? null,
                errorMessage: doc.errorMessage ?? null,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
            });
            return doc;
        }
        finally {
            await session.close();
        }
    }
    async findById(id) {
        const session = this.driver.session({ database: env_js_1.config.NEO4J_DATABASE });
        try {
            const result = await session.run(`MATCH (d:Document { id: $id }) RETURN d`, { id });
            if (result.records.length === 0)
                return null;
            const props = result.records[0].get('d').properties;
            return {
                id: props.id,
                title: props.title,
                originalFilename: props.originalFilename,
                mimeType: props.mimeType,
                fileSize: Number(props.fileSize),
                contentHash: props.contentHash,
                status: props.status,
                chunkCount: Number(props.chunkCount || 0),
                errorCode: props.errorCode || null,
                errorMessage: props.errorMessage || null,
                createdAt: props.createdAt,
                updatedAt: props.updatedAt,
            };
        }
        finally {
            await session.close();
        }
    }
    async findByHash(hash) {
        const session = this.driver.session({ database: env_js_1.config.NEO4J_DATABASE });
        try {
            const result = await session.run(`MATCH (d:Document { contentHash: $hash }) RETURN d LIMIT 1`, { hash });
            if (result.records.length === 0)
                return null;
            const props = result.records[0].get('d').properties;
            return {
                id: props.id,
                title: props.title,
                originalFilename: props.originalFilename,
                mimeType: props.mimeType,
                fileSize: Number(props.fileSize),
                contentHash: props.contentHash,
                status: props.status,
                chunkCount: Number(props.chunkCount || 0),
                errorCode: props.errorCode || null,
                errorMessage: props.errorMessage || null,
                createdAt: props.createdAt,
                updatedAt: props.updatedAt,
            };
        }
        finally {
            await session.close();
        }
    }
    async list(options) {
        const session = this.driver.session({ database: env_js_1.config.NEO4J_DATABASE });
        try {
            const skip = (options.page - 1) * options.limit;
            let whereClause = '';
            const params = {
                skip: Number(skip),
                limit: Number(options.limit),
            };
            const conditions = [];
            if (options.status) {
                conditions.push('d.status = $status');
                params.status = options.status;
            }
            if (options.search) {
                conditions.push('(toLower(d.title) CONTAINS toLower($search) OR toLower(d.originalFilename) CONTAINS toLower($search))');
                params.search = options.search;
            }
            if (conditions.length > 0) {
                whereClause = 'WHERE ' + conditions.join(' AND ');
            }
            const countResult = await session.run(`MATCH (d:Document) ${whereClause} RETURN count(d) AS total`, params);
            const total = countResult.records[0].get('total').toNumber();
            const listResult = await session.run(`MATCH (d:Document) ${whereClause}
         RETURN d
         ORDER BY d.createdAt DESC
         SKIP $skip LIMIT $limit`, params);
            const documents = listResult.records.map((r) => {
                const props = r.get('d').properties;
                return {
                    id: props.id,
                    title: props.title,
                    originalFilename: props.originalFilename,
                    mimeType: props.mimeType,
                    fileSize: Number(props.fileSize),
                    contentHash: props.contentHash,
                    status: props.status,
                    chunkCount: Number(props.chunkCount || 0),
                    errorCode: props.errorCode || null,
                    errorMessage: props.errorMessage || null,
                    createdAt: props.createdAt,
                    updatedAt: props.updatedAt,
                };
            });
            return { documents, total };
        }
        finally {
            await session.close();
        }
    }
    async updateStatus(id, status, updates) {
        const session = this.driver.session({ database: env_js_1.config.NEO4J_DATABASE });
        try {
            const updatedAt = new Date().toISOString();
            await session.run(`MATCH (d:Document { id: $id })
         SET d.status = $status,
             d.updatedAt = $updatedAt,
             d.chunkCount = coalesce($chunkCount, d.chunkCount),
             d.errorCode = $errorCode,
             d.errorMessage = $errorMessage`, {
                id,
                status,
                updatedAt,
                chunkCount: updates?.chunkCount !== undefined ? updates.chunkCount : null,
                errorCode: updates?.errorCode !== undefined ? updates.errorCode : null,
                errorMessage: updates?.errorMessage !== undefined ? updates.errorMessage : null,
            });
        }
        finally {
            await session.close();
        }
    }
    async delete(id) {
        const session = this.driver.session({ database: env_js_1.config.NEO4J_DATABASE });
        try {
            const res = await session.run(`MATCH (d:Document { id: $id })
         DETACH DELETE d
         RETURN count(d) AS deletedCount`, { id });
            return res.records[0].get('deletedCount').toNumber() > 0;
        }
        finally {
            await session.close();
        }
    }
}
exports.Neo4jDocumentRepository = Neo4jDocumentRepository;
