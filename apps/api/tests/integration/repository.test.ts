import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDocumentRepository, InMemoryGraphRepository } from '../../src/repositories/memory.repository.js';
import type { ChunkModel } from '../../src/schemas/document.schema.js';

describe('Graph Repository Integration & Safe Deletion', () => {
  let docRepo: InMemoryDocumentRepository;
  let graphRepo: InMemoryGraphRepository;

  beforeEach(() => {
    docRepo = new InMemoryDocumentRepository();
    graphRepo = new InMemoryGraphRepository();
  });

  it('safely deletes document chunks and claims while preserving shared entities referenced by other documents', async () => {
    // Document 1 references "Node.js"
    const doc1 = await docRepo.create({
      id: 'doc-1',
      title: 'NodeJS Intro',
      originalFilename: 'node.txt',
      mimeType: 'text/plain',
      fileSize: 100,
      contentHash: 'hash-node',
      status: 'completed',
      chunkCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const chunk1: ChunkModel = {
      id: 'chunk_doc1_0',
      documentId: 'doc-1',
      index: 0,
      text: 'Node.js is an open-source JavaScript runtime.',
      tokenEstimate: 10,
      contentHash: 'chash1',
    };
    await graphRepo.saveChunks(doc1.id, [chunk1]);

    // Document 2 also references "Node.js"
    const doc2 = await docRepo.create({
      id: 'doc-2',
      title: 'ExpressJS Intro',
      originalFilename: 'express.txt',
      mimeType: 'text/plain',
      fileSize: 100,
      contentHash: 'hash-express',
      status: 'completed',
      chunkCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const chunk2: ChunkModel = {
      id: 'chunk_doc2_0',
      documentId: 'doc-2',
      index: 0,
      text: 'Express runs on Node.js.',
      tokenEstimate: 10,
      contentHash: 'chash2',
    };
    await graphRepo.saveChunks(doc2.id, [chunk2]);

    // Shared entity "Node.js"
    const sharedEntity = {
      id: 'entity_nodejs',
      canonicalName: 'Node.js',
      normalizedName: 'nodejs',
      type: 'Technology',
      aliases: ['Node'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save mentions for both documents
    await graphRepo.saveEntitiesAndClaims({
      entities: [sharedEntity],
      claims: [
        {
          claim: {
            id: 'claim_1',
            subject: 'Express',
            predicate: 'RUNS_ON',
            object: 'Node.js',
            evidence: 'Express runs on Node.js.',
            confidence: 0.9,
          },
          subjectCanonicalName: 'Express',
          objectCanonicalName: 'Node.js',
          chunkId: 'chunk_doc2_0',
        },
      ],
      mentions: [
        { chunkId: 'chunk_doc1_0', entityId: 'entity_nodejs' },
        { chunkId: 'chunk_doc2_0', entityId: 'entity_nodejs' },
      ],
    });

    // Delete Document 1
    await graphRepo.safeDeleteDocumentGraph(doc1.id);
    await docRepo.delete(doc1.id);

    // Verify Doc 1 is gone
    const fetchedDoc1 = await docRepo.findById(doc1.id);
    expect(fetchedDoc1).toBeNull();

    // Verify Doc 2 still exists
    const fetchedDoc2 = await docRepo.findById(doc2.id);
    expect(fetchedDoc2).not.toBeNull();

    // Verify Shared Entity "Node.js" was PRESERVED because Doc 2 still references it!
    const entities = await graphRepo.findEntitiesByKeywords(['Node.js']);
    expect(entities.some((e) => e.canonicalName === 'Node.js')).toBe(true);

    // Verify chunks of Doc 1 were removed
    const chunksDoc1 = await graphRepo.getChunksByIds(['chunk_doc1_0']);
    expect(chunksDoc1).toHaveLength(0);

    // Verify chunks of Doc 2 remain intact
    const chunksDoc2 = await graphRepo.getChunksByIds(['chunk_doc2_0']);
    expect(chunksDoc2).toHaveLength(1);
  });
});

