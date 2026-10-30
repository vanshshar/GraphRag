"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Neo4jGraphRepository = void 0;
const env_js_1 = require("../config/env.js");
class Neo4jGraphRepository {
    driver;
    constructor(driver) {
        this.driver = driver;
    }
    async saveChunks(documentId, chunks) {
        if (chunks.length === 0)
            return;
        const session = this.driver.session({ database: env_js_1.config.NEO4J_DATABASE });
        try {
            const query = `
        MATCH (d:Document { id: $documentId })
        UNWIND $chunks AS cData
        MERGE (c:Chunk { id: cData.id })
        ON CREATE SET
          c.documentId = $documentId,
          c.index = cData.index,
          c.text = cData.text,
          c.tokenEstimate = cData.tokenEstimate,
          c.contentHash = cData.contentHash,
          c.pageNumber = cData.pageNumber,
          c.section = cData.section,
          c.embedding = cData.embedding
        ON MATCH SET
          c.text = cData.text,
          c.embedding = cData.embedding
        MERGE (d)-[:HAS_CHUNK]->(c)
      `;
            await session.run(query, {
                documentId,
                chunks: chunks.map((c) => ({
                    id: c.id,
                    index: c.index,
                    text: c.text,
                    tokenEstimate: c.tokenEstimate,
                    contentHash: c.contentHash,
                    pageNumber: c.pageNumber ?? null,
                    section: c.section ?? null,
                    embedding: c.embedding ?? null,
                })),
            });
        }
        finally {
            await session.close();
        }
    }
    async saveEntitiesAndClaims(data) {
        const session = this.driver.session({ database: env_js_1.config.NEO4J_DATABASE });
        try {
            // 1. Save / Merge Entities
            if (data.entities.length > 0) {
                await session.run(`
          UNWIND $entities AS eData
          MERGE (e:Entity { id: eData.id })
          ON CREATE SET
            e.canonicalName = eData.canonicalName,
            e.normalizedName = eData.normalizedName,
            e.type = eData.type,
            e.aliases = eData.aliases,
            e.createdAt = eData.createdAt,
            e.updatedAt = eData.updatedAt
          ON MATCH SET
            e.aliases = apoc.coll.toSet(e.aliases + eData.aliases),
            e.updatedAt = eData.updatedAt
          `, { entities: data.entities }).catch(async () => {
                    // Fallback if APOC is not enabled
                    await session.run(`
            UNWIND $entities AS eData
            MERGE (e:Entity { id: eData.id })
            ON CREATE SET
              e.canonicalName = eData.canonicalName,
              e.normalizedName = eData.normalizedName,
              e.type = eData.type,
              e.aliases = eData.aliases,
              e.createdAt = eData.createdAt,
              e.updatedAt = eData.updatedAt
            ON MATCH SET
              e.updatedAt = eData.updatedAt
            `, { entities: data.entities });
                });
            }
            // 2. Save Mentions
            if (data.mentions.length > 0) {
                await session.run(`
          UNWIND $mentions AS m
          MATCH (c:Chunk { id: m.chunkId })
          MATCH (e:Entity { id: m.entityId })
          MERGE (c)-[:MENTIONS]->(e)
          `, { mentions: data.mentions });
            }
            // 3. Save Claims and Relationships
            if (data.claims.length > 0) {
                await session.run(`
          UNWIND $claims AS item
          MATCH (sub:Entity { canonicalName: item.subjectCanonicalName })
          MATCH (obj:Entity { canonicalName: item.objectCanonicalName })
          MATCH (chunk:Chunk { id: item.chunkId })
          MERGE (cl:Claim { id: item.claim.id })
          ON CREATE SET
            cl.subject = item.claim.subject,
            cl.predicate = item.claim.predicate,
            cl.object = item.claim.object,
            cl.evidence = item.claim.evidence,
            cl.confidence = item.claim.confidence,
            cl.extractionVersion = item.claim.extractionVersion
          MERGE (sub)-[:SUBJECT_OF]->(cl)
          MERGE (cl)-[:OBJECT_OF]->(obj)
          MERGE (cl)-[:SUPPORTED_BY]->(chunk)
          `, {
                    claims: data.claims.map((c) => ({
                        claim: c.claim,
                        subjectCanonicalName: c.subjectCanonicalName,
                        objectCanonicalName: c.objectCanonicalName,
                        chunkId: c.chunkId,
                    })),
                });
            }
        }
        finally {
            await session.close();
        }
    }
    async findEntitiesByKeywords(keywords) {
        if (keywords.length === 0)
            return [];
        const session = this.driver.session({ database: env_js_1.config.NEO4J_DATABASE });
        try {
            const query = `
        UNWIND $keywords AS kw
        MATCH (e:Entity)
        WHERE toLower(e.normalizedName) = toLower(kw)
           OR toLower(e.canonicalName) = toLower(kw)
           OR ANY(alias IN e.aliases WHERE toLower(alias) = toLower(kw))
        RETURN DISTINCT e
        LIMIT 25
      `;
            const result = await session.run(query, { keywords });
            return result.records.map((r) => {
                const props = r.get('e').properties;
                return {
                    id: props.id,
                    canonicalName: props.canonicalName,
                    normalizedName: props.normalizedName,
                    type: props.type,
                    aliases: props.aliases || [],
                    createdAt: props.createdAt,
                    updatedAt: props.updatedAt,
                };
            });
        }
        finally {
            await session.close();
        }
    }
    async searchChunksByKeyword(keyword, limit = 10) {
        const session = this.driver.session({ database: env_js_1.config.NEO4J_DATABASE });
        try {
            const query = `
        MATCH (c:Chunk)
        WHERE toLower(c.text) CONTAINS toLower($keyword)
        RETURN c
        LIMIT $limit
      `;
            const result = await session.run(query, {
                keyword,
                limit: Number(limit),
            });
            return result.records.map((r) => {
                const p = r.get('c').properties;
                return {
                    id: p.id,
                    documentId: p.documentId,
                    index: Number(p.index),
                    text: p.text,
                    tokenEstimate: Number(p.tokenEstimate || 0),
                    pageNumber: p.pageNumber ? Number(p.pageNumber) : null,
                    section: p.section || null,
                    contentHash: p.contentHash,
                    embedding: p.embedding || undefined,
                };
            });
        }
        finally {
            await session.close();
        }
    }
    async traverseGraphFromEntities(entityIds, _maxHops = 2, limit = 25) {
        if (entityIds.length === 0) {
            return { entities: [], claims: [], supportingChunkIds: [] };
        }
        const session = this.driver.session({ database: env_js_1.config.NEO4J_DATABASE });
        try {
            const query = `
        MATCH (start:Entity)
        WHERE start.id IN $entityIds
        OPTIONAL MATCH (start)-[:SUBJECT_OF|OBJECT_OF]-(cl:Claim)
        OPTIONAL MATCH (cl)-[:SUPPORTED_BY]->(chunk:Chunk)
        OPTIONAL MATCH (cl)-[:SUBJECT_OF|OBJECT_OF]-(neighbor:Entity)
        RETURN
          collect(DISTINCT start) + collect(DISTINCT neighbor) AS allEntities,
          collect(DISTINCT cl) AS allClaims,
          collect(DISTINCT chunk.id) AS chunkIds
        LIMIT $limit
      `;
            const result = await session.run(query, {
                entityIds,
                limit: Number(limit),
            });
            if (result.records.length === 0) {
                return { entities: [], claims: [], supportingChunkIds: [] };
            }
            const rec = result.records[0];
            const rawEntities = rec.get('allEntities') || [];
            const rawClaims = rec.get('allClaims') || [];
            const chunkIds = (rec.get('chunkIds') || []).filter((id) => Boolean(id));
            const entities = rawEntities.map((e) => ({
                id: e.properties.id,
                canonicalName: e.properties.canonicalName,
                normalizedName: e.properties.normalizedName,
                type: e.properties.type,
                aliases: e.properties.aliases || [],
                createdAt: e.properties.createdAt,
                updatedAt: e.properties.updatedAt,
            }));
            const claims = rawClaims.map((cl) => ({
                id: cl.properties.id,
                subject: cl.properties.subject,
                predicate: cl.properties.predicate,
                object: cl.properties.object,
                evidence: cl.properties.evidence,
                confidence: cl.properties.confidence ? Number(cl.properties.confidence) : undefined,
                extractionVersion: cl.properties.extractionVersion,
            }));
            return { entities, claims, supportingChunkIds: chunkIds };
        }
        finally {
            await session.close();
        }
    }
    async getChunksByIds(chunkIds) {
        if (chunkIds.length === 0)
            return [];
        const session = this.driver.session({ database: env_js_1.config.NEO4J_DATABASE });
        try {
            const result = await session.run(`MATCH (c:Chunk) WHERE c.id IN $chunkIds RETURN c`, { chunkIds });
            return result.records.map((r) => {
                const p = r.get('c').properties;
                return {
                    id: p.id,
                    documentId: p.documentId,
                    index: Number(p.index),
                    text: p.text,
                    tokenEstimate: Number(p.tokenEstimate || 0),
                    pageNumber: p.pageNumber ? Number(p.pageNumber) : null,
                    section: p.section || null,
                    contentHash: p.contentHash,
                    embedding: p.embedding || undefined,
                };
            });
        }
        finally {
            await session.close();
        }
    }
    async getStats() {
        const session = this.driver.session({ database: env_js_1.config.NEO4J_DATABASE });
        try {
            const result = await session.run(`
        CALL { MATCH (d:Document) RETURN count(d) AS docCount }
        CALL { MATCH (c:Chunk) RETURN count(c) AS chunkCount }
        CALL { MATCH (e:Entity) RETURN count(e) AS entityCount }
        CALL { MATCH (cl:Claim) RETURN count(cl) AS claimCount }
        RETURN docCount, chunkCount, entityCount, claimCount
      `);
            if (result.records.length === 0) {
                return { documentCount: 0, chunkCount: 0, entityCount: 0, claimCount: 0 };
            }
            const r = result.records[0];
            return {
                documentCount: r.get('docCount').toNumber(),
                chunkCount: r.get('chunkCount').toNumber(),
                entityCount: r.get('entityCount').toNumber(),
                claimCount: r.get('claimCount').toNumber(),
            };
        }
        finally {
            await session.close();
        }
    }
    async safeDeleteDocumentGraph(documentId) {
        const session = this.driver.session({ database: env_js_1.config.NEO4J_DATABASE });
        try {
            // 1. Detach and delete all chunks for this document
            await session.run(`
        MATCH (d:Document { id: $documentId })-[:HAS_CHUNK]->(c:Chunk)
        DETACH DELETE c
        `, { documentId });
            // 2. Remove orphan Claims that no longer have any SUPPORTED_BY links
            await session.run(`
        MATCH (cl:Claim)
        WHERE NOT (cl)-[:SUPPORTED_BY]->()
        DETACH DELETE cl
      `);
            // 3. Remove orphan Entities that have no remaining relationships
            await session.run(`
        MATCH (e:Entity)
        WHERE NOT (e)--()
        DELETE e
      `);
        }
        finally {
            await session.close();
        }
    }
}
exports.Neo4jGraphRepository = Neo4jGraphRepository;
