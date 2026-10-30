import type { IDocumentRepository, IGraphRepository } from './types.js';
import type { DocumentModel, DocumentStatus, ChunkModel } from '../schemas/document.schema.js';
import type { EntityNode, ClaimNode, GraphStats } from '../schemas/graph.schema.js';

export class InMemoryDocumentRepository implements IDocumentRepository {
  private docs = new Map<string, DocumentModel>();

  public async create(doc: DocumentModel): Promise<DocumentModel> {
    this.docs.set(doc.id, { ...doc });
    return doc;
  }

  public async findById(id: string): Promise<DocumentModel | null> {
    const doc = this.docs.get(id);
    return doc ? { ...doc } : null;
  }

  public async findByHash(hash: string): Promise<DocumentModel | null> {
    for (const doc of this.docs.values()) {
      if (doc.contentHash === hash) return { ...doc };
    }
    return null;
  }

  public async list(options: {
    page: number;
    limit: number;
    status?: DocumentStatus;
    search?: string;
  }): Promise<{ documents: DocumentModel[]; total: number }> {
    let items = Array.from(this.docs.values());
    if (options.status) {
      items = items.filter((d) => d.status === options.status);
    }
    if (options.search) {
      const q = options.search.toLowerCase();
      items = items.filter(
        (d) => d.title.toLowerCase().includes(q) || d.originalFilename.toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = items.length;
    const start = (options.page - 1) * options.limit;
    const paged = items.slice(start, start + options.limit);
    return { documents: paged, total };
  }

  public async updateStatus(
    id: string,
    status: DocumentStatus,
    updates?: { chunkCount?: number; errorCode?: string | null; errorMessage?: string | null }
  ): Promise<void> {
    const doc = this.docs.get(id);
    if (!doc) return;
    doc.status = status;
    doc.updatedAt = new Date().toISOString();
    if (updates?.chunkCount !== undefined) doc.chunkCount = updates.chunkCount;
    if (updates?.errorCode !== undefined) doc.errorCode = updates.errorCode;
    if (updates?.errorMessage !== undefined) doc.errorMessage = updates.errorMessage;
  }

  public async delete(id: string): Promise<boolean> {
    return this.docs.delete(id);
  }

  public clear(): void {
    this.docs.clear();
  }
}

export class InMemoryGraphRepository implements IGraphRepository {
  private chunks = new Map<string, ChunkModel>();
  private entities = new Map<string, EntityNode>();
  private claims = new Map<string, ClaimNode>();
  private claimSupportedBy = new Map<string, Set<string>>(); // claimId -> Set<chunkId>
  private chunkMentions = new Map<string, Set<string>>(); // chunkId -> Set<entityId>
  private docChunks = new Map<string, Set<string>>(); // documentId -> Set<chunkId>

  public async saveChunks(documentId: string, chunks: ChunkModel[]): Promise<void> {
    if (!this.docChunks.has(documentId)) {
      this.docChunks.set(documentId, new Set());
    }
    const docSet = this.docChunks.get(documentId)!;
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, { ...chunk });
      docSet.add(chunk.id);
    }
  }

  public async saveEntitiesAndClaims(data: {
    entities: EntityNode[];
    claims: Array<{
      claim: ClaimNode;
      subjectCanonicalName: string;
      objectCanonicalName: string;
      chunkId: string;
    }>;
    mentions: Array<{
      chunkId: string;
      entityId: string;
    }>;
  }): Promise<void> {
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
      } else {
        this.entities.set(ent.id, { ...ent });
      }
    }

    // Save mentions
    for (const m of data.mentions) {
      if (!this.chunkMentions.has(m.chunkId)) {
        this.chunkMentions.set(m.chunkId, new Set());
      }
      this.chunkMentions.get(m.chunkId)!.add(m.entityId);
    }

    // Save claims
    for (const item of data.claims) {
      this.claims.set(item.claim.id, { ...item.claim });
      if (!this.claimSupportedBy.has(item.claim.id)) {
        this.claimSupportedBy.set(item.claim.id, new Set());
      }
      this.claimSupportedBy.get(item.claim.id)!.add(item.chunkId);
    }
  }

  public async findEntitiesByKeywords(keywords: string[]): Promise<EntityNode[]> {
    const results: EntityNode[] = [];
    const lowerKws = keywords.map((k) => k.toLowerCase());

    for (const ent of this.entities.values()) {
      const match =
        lowerKws.includes(ent.normalizedName.toLowerCase()) ||
        lowerKws.includes(ent.canonicalName.toLowerCase()) ||
        ent.aliases.some((a) => lowerKws.includes(a.toLowerCase()));

      if (match) {
        results.push({ ...ent });
      }
    }
    return results;
  }

  public async searchChunksByKeyword(keyword: string, limit = 10): Promise<ChunkModel[]> {
    const q = keyword.toLowerCase();
    const results: ChunkModel[] = [];
    for (const c of this.chunks.values()) {
      if (c.text.toLowerCase().includes(q)) {
        results.push({ ...c });
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  public async traverseGraphFromEntities(
    entityIds: string[],
    _maxHops = 2,
    limit = 25
  ): Promise<{
    entities: EntityNode[];
    claims: ClaimNode[];
    supportingChunkIds: string[];
  }> {
    const foundEntities = new Map<string, EntityNode>();
    const foundClaims = new Map<string, ClaimNode>();
    const chunkIds = new Set<string>();

    for (const eid of entityIds) {
      const ent = this.entities.get(eid);
      if (ent) foundEntities.set(eid, { ...ent });
    }

    for (const claim of this.claims.values()) {
      const matchSub = Array.from(foundEntities.values()).some(
        (e) => e.canonicalName.toLowerCase() === claim.subject.toLowerCase()
      );
      const matchObj = Array.from(foundEntities.values()).some(
        (e) => e.canonicalName.toLowerCase() === claim.object.toLowerCase()
      );

      if (matchSub || matchObj) {
        foundClaims.set(claim.id, { ...claim });
        const supChunks = this.claimSupportedBy.get(claim.id);
        if (supChunks) {
          for (const cid of supChunks) chunkIds.add(cid);
        }
      }
      if (foundClaims.size >= limit) break;
    }

    return {
      entities: Array.from(foundEntities.values()),
      claims: Array.from(foundClaims.values()),
      supportingChunkIds: Array.from(chunkIds),
    };
  }

  public async getChunksByIds(chunkIds: string[]): Promise<ChunkModel[]> {
    const result: ChunkModel[] = [];
    for (const id of chunkIds) {
      const chunk = this.chunks.get(id);
      if (chunk) result.push({ ...chunk });
    }
    return result;
  }

  public async getStats(): Promise<GraphStats> {
    return {
      documentCount: this.docChunks.size,
      chunkCount: this.chunks.size,
      entityCount: this.entities.size,
      claimCount: this.claims.size,
    };
  }

  public async safeDeleteDocumentGraph(documentId: string): Promise<void> {
    const chunkIds = this.docChunks.get(documentId);
    if (!chunkIds) return;

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
    const referencedEntities = new Set<string>();
    for (const entSet of this.chunkMentions.values()) {
      for (const eid of entSet) referencedEntities.add(eid);
    }
    for (const claim of this.claims.values()) {
      for (const ent of this.entities.values()) {
        if (
          ent.canonicalName.toLowerCase() === claim.subject.toLowerCase() ||
          ent.canonicalName.toLowerCase() === claim.object.toLowerCase()
        ) {
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

  public clear(): void {
    this.chunks.clear();
    this.entities.clear();
    this.claims.clear();
    this.claimSupportedBy.clear();
    this.chunkMentions.clear();
    this.docChunks.clear();
  }
}

