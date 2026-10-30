import type { DocumentModel, DocumentStatus, ChunkModel } from '../schemas/document.schema.js';
import type { EntityNode, ClaimNode, GraphStats } from '../schemas/graph.schema.js';

export interface IDocumentRepository {
  create(doc: DocumentModel): Promise<DocumentModel>;
  findById(id: string): Promise<DocumentModel | null>;
  findByHash(hash: string): Promise<DocumentModel | null>;
  list(options: {
    page: number;
    limit: number;
    status?: DocumentStatus;
    search?: string;
  }): Promise<{ documents: DocumentModel[]; total: number }>;
  updateStatus(
    id: string,
    status: DocumentStatus,
    updates?: { chunkCount?: number; errorCode?: string | null; errorMessage?: string | null }
  ): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export interface IGraphRepository {
  saveChunks(documentId: string, chunks: ChunkModel[]): Promise<void>;
  saveEntitiesAndClaims(data: {
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
  }): Promise<void>;

  findEntitiesByKeywords(keywords: string[]): Promise<EntityNode[]>;
  searchChunksByKeyword(keyword: string, limit?: number): Promise<ChunkModel[]>;
  traverseGraphFromEntities(
    entityIds: string[],
    maxHops: number,
    limit: number
  ): Promise<{
    entities: EntityNode[];
    claims: ClaimNode[];
    supportingChunkIds: string[];
  }>;
  getChunksByIds(chunkIds: string[]): Promise<ChunkModel[]>;
  getStats(): Promise<GraphStats>;
  safeDeleteDocumentGraph(documentId: string): Promise<void>;
}

