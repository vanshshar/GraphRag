"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryGraphRepository = exports.InMemoryDocumentRepository = void 0;
class InMemoryDocumentRepository {
    docs = new Map();
    async create(doc) {
        this.docs.set(doc.id, { ...doc });
        return doc;
    }
    async findById(id) {
        const doc = this.docs.get(id);
        return doc ? { ...doc } : null;
    }
    async findByHash(hash) {
        for (const doc of this.docs.values()) {
            if (doc.contentHash === hash)
                return { ...doc };
        }
        return null;
    }
    async list(options) {
        let items = Array.from(this.docs.values());
        if (options.status) {
            items = items.filter((d) => d.status === options.status);
        }
        if (options.search) {
            const q = options.search.toLowerCase();
            items = items.filter((d) => d.title.toLowerCase().includes(q) || d.originalFilename.toLowerCase().includes(q));
        }
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const total = items.length;
        const start = (options.page - 1) * options.limit;
        const paged = items.slice(start, start + options.limit);
        return { documents: paged, total };
    }
    async updateStatus(id, status, updates) {
        const doc = this.docs.get(id);
        if (!doc)
            return;
        doc.status = status;
        doc.updatedAt = new Date().toISOString();
        if (updates?.chunkCount !== undefined)
            doc.chunkCount = updates.chunkCount;
        if (updates?.errorCode !== undefined)
            doc.errorCode = updates.errorCode;
        if (updates?.errorMessage !== undefined)
            doc.errorMessage = updates.errorMessage;
    }
    async delete(id) {
        return this.docs.delete(id);
    }
    clear() {
        this.docs.clear();
    }
}
exports.InMemoryDocumentRepository = InMemoryDocumentRepository;
class InMemoryGraphRepository {
    chunks = new Map();
    entities = new Map();
    claims = new Map();
    claimSupportedBy = new Map(); // claimId -> Set<chunkId>
    chunkMentions = new Map(); // chunkId -> Set<entityId>
    docChunks = new Map(); // documentId -> Set<chunkId>
    async saveChunks(documentId, chunks) {
        if (!this.docChunks.has(documentId)) {
            this.docChunks.set(documentId, new Set());
        }
        const docSet = this.docChunks.get(documentId);
        for (const chunk of chunks) {
            this.chunks.set(chunk.id, { ...chunk });
            docSet.add(chunk.id);
        }
    }
    async saveEntitiesAndClaims(data) {
        // Save entities
        for (const ent of data.entities) {
            const existing = this.entities.get(ent.id);
            if (existing) {
                const combinedAliases = Array.from(new Set([...existing.aliases, ...ent.aliases]));
                this.entities.set(ent.id, {
                    ...existing,
                    aliases: combinedAliases,
                    updatedAt: ent.updatedAt,
                });
            }
            else {
                this.entities.set(ent.id, { ...ent });
            }
        }
        // Save mentions
        for (const m of data.mentions) {
            if (!this.chunkMentions.has(m.chunkId)) {
                this.chunkMentions.set(m.chunkId, new Set());
            }
            this.chunkMentions.get(m.chunkId).add(m.entityId);
        }
        // Save claims
        for (const item of data.claims) {
            this.claims.set(item.claim.id, { ...item.claim });
            if (!this.claimSupportedBy.has(item.claim.id)) {
                this.claimSupportedBy.set(item.claim.id, new Set());
            }
            this.claimSupportedBy.get(item.claim.id).add(item.chunkId);
        }
    }
    async findEntitiesByKeywords(keywords) {
        const results = [];
        const lowerKws = keywords.map((k) => k.toLowerCase());
        for (const ent of this.entities.values()) {
            const match = lowerKws.includes(ent.normalizedName.toLowerCase()) ||
                lowerKws.includes(ent.canonicalName.toLowerCase()) ||
                ent.aliases.some((a) => lowerKws.includes(a.toLowerCase()));
            if (match) {
                results.push({ ...ent });
            }
        }
        return results;
    }
    async searchChunksByKeyword(keyword, limit = 10) {
        const q = keyword.toLowerCase();
        const results = [];
        for (const c of this.chunks.values()) {
            if (c.text.toLowerCase().includes(q)) {
                results.push({ ...c });
                if (results.length >= limit)
                    break;
            }
        }
        return results;
    }
    async traverseGraphFromEntities(entityIds, _maxHops = 2, limit = 25) {
        const foundEntities = new Map();
        const foundClaims = new Map();
        const chunkIds = new Set();
        for (const eid of entityIds) {
            const ent = this.entities.get(eid);
            if (ent)
                foundEntities.set(eid, { ...ent });
        }
        for (const claim of this.claims.values()) {
            const matchSub = Array.from(foundEntities.values()).some((e) => e.canonicalName.toLowerCase() === claim.subject.toLowerCase());
            const matchObj = Array.from(foundEntities.values()).some((e) => e.canonicalName.toLowerCase() === claim.object.toLowerCase());
            if (matchSub || matchObj) {
                foundClaims.set(claim.id, { ...claim });
                const supChunks = this.claimSupportedBy.get(claim.id);
                if (supChunks) {
                    for (const cid of supChunks)
                        chunkIds.add(cid);
                }
            }
            if (foundClaims.size >= limit)
                break;
        }
        return {
            entities: Array.from(foundEntities.values()),
            claims: Array.from(foundClaims.values()),
            supportingChunkIds: Array.from(chunkIds),
        };
    }
    async getChunksByIds(chunkIds) {
        const result = [];
        for (const id of chunkIds) {
            const chunk = this.chunks.get(id);
            if (chunk)
                result.push({ ...chunk });
        }
        return result;
    }
    async getStats() {
        return {
            documentCount: this.docChunks.size,
            chunkCount: this.chunks.size,
            entityCount: this.entities.size,
            claimCount: this.claims.size,
        };
    }
    async safeDeleteDocumentGraph(documentId) {
        const chunkIds = this.docChunks.get(documentId);
        if (!chunkIds)
            return;
        // Remove chunks
        for (const cid of chunkIds) {
            this.chunks.delete(cid);
            this.chunkMentions.delete(cid);
            // Remove cid from claimSupportedBy
            for (const [claimId, set] of this.claimSupportedBy.entries()) {
                set.delete(cid);
                if (set.size === 0) {
                    this.claims.delete(claimId);
                    this.claimSupportedBy.delete(claimId);
                }
            }
        }
        this.docChunks.delete(documentId);
        // Clean orphan entities that have no mentions or active claims
        const referencedEntities = new Set();
        for (const entSet of this.chunkMentions.values()) {
            for (const eid of entSet)
                referencedEntities.add(eid);
        }
        for (const claim of this.claims.values()) {
            for (const ent of this.entities.values()) {
                if (ent.canonicalName.toLowerCase() === claim.subject.toLowerCase() ||
                    ent.canonicalName.toLowerCase() === claim.object.toLowerCase()) {
                    referencedEntities.add(ent.id);
                }
            }
        }
        for (const eid of Array.from(this.entities.keys())) {
            if (!referencedEntities.has(eid)) {
                this.entities.delete(eid);
            }
        }
    }
    clear() {
        this.chunks.clear();
        this.entities.clear();
        this.claims.clear();
        this.claimSupportedBy.clear();
        this.chunkMentions.clear();
        this.docChunks.clear();
    }
}
exports.InMemoryGraphRepository = InMemoryGraphRepository;
