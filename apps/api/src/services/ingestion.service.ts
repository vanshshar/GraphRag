import { v4 as uuidv4 } from 'uuid';
import { sha256, generateDeterministicId } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';
import { TextExtractorService } from './textExtractor.service.js';
import { ChunkingService } from './chunking.service.js';
import { EntityResolverService } from './entityResolver.service.js';
import type { IDocumentRepository, IGraphRepository } from '../repositories/types.js';
import type { ILlmProvider } from '../providers/llm/types.js';
import type { IEmbeddingProvider } from '../providers/embeddings/types.js';
import type { DocumentModel } from '../schemas/document.schema.js';
import type { ClaimNode, EntityNode } from '../schemas/graph.schema.js';

export interface IngestionOptions {
  chunkSize: number;
  chunkOverlap: number;
}

export class IngestionService {
  constructor(
    private docRepo: IDocumentRepository,
    private graphRepo: IGraphRepository,
    private llmProvider: ILlmProvider,
    private embeddingProvider: IEmbeddingProvider,
    private options: IngestionOptions
  ) {}

  public async processDocument(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    requestId: string
  ): Promise<DocumentModel> {
    const fileSize = fileBuffer.length;
    const contentHash = sha256(fileBuffer);
    const now = new Date().toISOString();

    // Check for existing document with same hash (idempotency)
    const existing = await this.docRepo.findByHash(contentHash);
    if (existing && existing.status === 'completed') {
      logger.info(
        { documentId: existing.id, contentHash, requestId },
        'Document with identical content already ingested. Returning existing record.'
      );
      return existing;
    }

    const documentId = existing ? existing.id : uuidv4();
    const title = filename.replace(/\.[^/.]+$/, '');

    let document: DocumentModel = {
      id: documentId,
      title,
      originalFilename: filename,
      mimeType,
      fileSize,
      contentHash,
      status: 'processing',
      chunkCount: 0,
      errorCode: null,
      errorMessage: null,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    if (existing) {
      await this.docRepo.updateStatus(documentId, 'processing', {
        errorCode: null,
        errorMessage: null,
      });
    } else {
      document = await this.docRepo.create(document);
    }

    try {
      // 1. Text extraction
      logger.info({ documentId, filename, requestId }, 'Extracting text from file');
      const { text, pageCount } = await TextExtractorService.extract(fileBuffer, mimeType, filename);

      // 2. Chunking
      logger.info({ documentId, textLength: text.length, requestId }, 'Chunking document text');
      const chunks = ChunkingService.chunkText(documentId, text, {
        chunkSize: this.options.chunkSize,
        chunkOverlap: this.options.chunkOverlap,
      });

      if (chunks.length === 0) {
        throw new Error('Extracted text resulted in 0 valid chunks.');
      }

      // If page count available, distribute estimated page numbers
      if (pageCount && pageCount > 1) {
        const chunksPerPage = Math.ceil(chunks.length / pageCount);
        chunks.forEach((chunk, idx) => {
          chunk.pageNumber = Math.min(pageCount, Math.floor(idx / chunksPerPage) + 1);
        });
      }

      // 3. Generate embeddings
      logger.info({ documentId, chunkCount: chunks.length, requestId }, 'Generating embeddings for chunks');
      const chunkTexts = chunks.map((c) => c.text);
      const embeddings = await this.embeddingProvider.generateBatchEmbeddings(chunkTexts);
      chunks.forEach((chunk, idx) => {
        chunk.embedding = embeddings[idx];
      });

      // 4. Save chunks to Graph Repository
      await this.graphRepo.saveChunks(documentId, chunks);

      // 5. LLM Entity and Claim extraction per chunk
      logger.info({ documentId, requestId }, 'Extracting entities and claims via LLM');
      const allEntitiesMap = new Map<string, EntityNode>();
      const allMentions: Array<{ chunkId: string; entityId: string }> = [];
      const allClaimsData: Array<{
        claim: ClaimNode;
        subjectCanonicalName: string;
        objectCanonicalName: string;
        chunkId: string;
      }> = [];

      for (const chunk of chunks) {
        try {
          const extraction = await this.llmProvider.extractEntitiesAndClaims(chunk.text);

          // Resolve entities
          for (const rawEntity of extraction.entities) {
            const resolved = EntityResolverService.resolveEntity(rawEntity);
            if (!allEntitiesMap.has(resolved.id)) {
              allEntitiesMap.set(resolved.id, resolved);
            } else {
              // Merge aliases
              const existingEnt = allEntitiesMap.get(resolved.id)!;
              existingEnt.aliases = Array.from(
                new Set([...existingEnt.aliases, ...resolved.aliases])
              );
            }

            allMentions.push({
              chunkId: chunk.id,
              entityId: resolved.id,
            });
          }

          // Resolve claims
          for (const rawClaim of extraction.claims) {
            const subNorm = EntityResolverService.normalizeName(rawClaim.subject);
            const objNorm = EntityResolverService.normalizeName(rawClaim.object);

            // Ensure subject and object entities exist
            const subEntity = EntityResolverService.resolveEntity({
              name: rawClaim.subject,
              type: 'Concept',
              aliases: [],
            });
            const objEntity = EntityResolverService.resolveEntity({
              name: rawClaim.object,
              type: 'Concept',
              aliases: [],
            });

            if (!allEntitiesMap.has(subEntity.id)) allEntitiesMap.set(subEntity.id, subEntity);
            if (!allEntitiesMap.has(objEntity.id)) allEntitiesMap.set(objEntity.id, objEntity);

            const claimKey = `${subNorm}_${rawClaim.predicate}_${objNorm}`;
            const claimId = generateDeterministicId('claim', claimKey);

            allClaimsData.push({
              claim: {
                id: claimId,
                subject: subEntity.canonicalName,
                predicate: rawClaim.predicate,
                object: objEntity.canonicalName,
                evidence: rawClaim.evidence,
                confidence: rawClaim.confidence,
                extractionVersion: 'v1.0',
              },
              subjectCanonicalName: subEntity.canonicalName,
              objectCanonicalName: objEntity.canonicalName,
              chunkId: chunk.id,
            });
          }
        } catch (extractErr: any) {
          logger.warn(
            { documentId, chunkId: chunk.id, error: extractErr.message, requestId },
            'Extraction failed for single chunk; continuing with remaining chunks'
          );
        }
      }

      // 6. Persist entities, claims, mentions
      await this.graphRepo.saveEntitiesAndClaims({
        entities: Array.from(allEntitiesMap.values()),
        claims: allClaimsData,
        mentions: allMentions,
      });

      // 7. Update document status to completed
      await this.docRepo.updateStatus(documentId, 'completed', {
        chunkCount: chunks.length,
        errorCode: null,
        errorMessage: null,
      });

      logger.info(
        { documentId, chunkCount: chunks.length, entityCount: allEntitiesMap.size, requestId },
        'Document ingestion successfully completed'
      );

      const completedDoc = await this.docRepo.findById(documentId);
      return completedDoc || { ...document, status: 'completed', chunkCount: chunks.length };
    } catch (err: any) {
      logger.error(
        { documentId, error: err.message, stack: err.stack, requestId },
        'Document ingestion failed'
      );

      await this.docRepo.updateStatus(documentId, 'failed', {
        errorCode: 'INGESTION_ERROR',
        errorMessage: err.message || 'An error occurred during ingestion.',
      });

      throw err;
    }
  }

  public async reprocessDocument(documentId: string, requestId: string): Promise<DocumentModel> {
    const doc = await this.docRepo.findById(documentId);
    if (!doc) {
      throw new Error(`Document with ID "${documentId}" not found.`);
    }

    // Reset status to processing and remove prior graph nodes for this document
    await this.docRepo.updateStatus(documentId, 'processing');
    await this.graphRepo.safeDeleteDocumentGraph(documentId);

    // Re-create from chunks if document text is stored or re-ingest
    logger.info({ documentId, requestId }, 'Reprocessing document graph');
    return doc;
  }
}

