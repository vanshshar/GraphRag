"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionService = void 0;
const uuid_1 = require("uuid");
const crypto_js_1 = require("../utils/crypto.js");
const logger_js_1 = require("../utils/logger.js");
const textExtractor_service_js_1 = require("./textExtractor.service.js");
const chunking_service_js_1 = require("./chunking.service.js");
const entityResolver_service_js_1 = require("./entityResolver.service.js");
class IngestionService {
    docRepo;
    graphRepo;
    llmProvider;
    embeddingProvider;
    options;
    constructor(docRepo, graphRepo, llmProvider, embeddingProvider, options) {
        this.docRepo = docRepo;
        this.graphRepo = graphRepo;
        this.llmProvider = llmProvider;
        this.embeddingProvider = embeddingProvider;
        this.options = options;
    }
    async processDocument(fileBuffer, filename, mimeType, requestId) {
        const fileSize = fileBuffer.length;
        const contentHash = (0, crypto_js_1.sha256)(fileBuffer);
        const now = new Date().toISOString();
        // Check for existing document with same hash (idempotency)
        const existing = await this.docRepo.findByHash(contentHash);
        if (existing && existing.status === 'completed') {
            logger_js_1.logger.info({ documentId: existing.id, contentHash, requestId }, 'Document with identical content already ingested. Returning existing record.');
            return existing;
        }
        const documentId = existing ? existing.id : (0, uuid_1.v4)();
        const title = filename.replace(/\.[^/.]+$/, '');
        let document = {
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
        }
        else {
            document = await this.docRepo.create(document);
        }
        try {
            // 1. Text extraction
            logger_js_1.logger.info({ documentId, filename, requestId }, 'Extracting text from file');
            const { text, pageCount } = await textExtractor_service_js_1.TextExtractorService.extract(fileBuffer, mimeType, filename);
            // 2. Chunking
            logger_js_1.logger.info({ documentId, textLength: text.length, requestId }, 'Chunking document text');
            const chunks = chunking_service_js_1.ChunkingService.chunkText(documentId, text, {
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
            logger_js_1.logger.info({ documentId, chunkCount: chunks.length, requestId }, 'Generating embeddings for chunks');
            const chunkTexts = chunks.map((c) => c.text);
            const embeddings = await this.embeddingProvider.generateBatchEmbeddings(chunkTexts);
            chunks.forEach((chunk, idx) => {
                chunk.embedding = embeddings[idx];
            });
            // 4. Save chunks to Graph Repository
            await this.graphRepo.saveChunks(documentId, chunks);
            // 5. LLM Entity and Claim extraction per chunk
            logger_js_1.logger.info({ documentId, requestId }, 'Extracting entities and claims via LLM');
            const allEntitiesMap = new Map();
            const allMentions = [];
            const allClaimsData = [];
            for (const chunk of chunks) {
                try {
                    const extraction = await this.llmProvider.extractEntitiesAndClaims(chunk.text);
                    // Resolve entities
                    for (const rawEntity of extraction.entities) {
                        const resolved = entityResolver_service_js_1.EntityResolverService.resolveEntity(rawEntity);
                        if (!allEntitiesMap.has(resolved.id)) {
                            allEntitiesMap.set(resolved.id, resolved);
                        }
                        else {
                            // Merge aliases
                            const existingEnt = allEntitiesMap.get(resolved.id);
                            existingEnt.aliases = Array.from(new Set([...existingEnt.aliases, ...resolved.aliases]));
                        }
                        allMentions.push({
                            chunkId: chunk.id,
                            entityId: resolved.id,
                        });
                    }
                    // Resolve claims
                    for (const rawClaim of extraction.claims) {
                        const subNorm = entityResolver_service_js_1.EntityResolverService.normalizeName(rawClaim.subject);
                        const objNorm = entityResolver_service_js_1.EntityResolverService.normalizeName(rawClaim.object);
                        // Ensure subject and object entities exist
                        const subEntity = entityResolver_service_js_1.EntityResolverService.resolveEntity({
                            name: rawClaim.subject,
                            type: 'Concept',
                            aliases: [],
                        });
                        const objEntity = entityResolver_service_js_1.EntityResolverService.resolveEntity({
                            name: rawClaim.object,
                            type: 'Concept',
                            aliases: [],
                        });
                        if (!allEntitiesMap.has(subEntity.id))
                            allEntitiesMap.set(subEntity.id, subEntity);
                        if (!allEntitiesMap.has(objEntity.id))
                            allEntitiesMap.set(objEntity.id, objEntity);
                        const claimKey = `${subNorm}_${rawClaim.predicate}_${objNorm}`;
                        const claimId = (0, crypto_js_1.generateDeterministicId)('claim', claimKey);
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
                }
                catch (extractErr) {
                    logger_js_1.logger.warn({ documentId, chunkId: chunk.id, error: extractErr.message, requestId }, 'Extraction failed for single chunk; continuing with remaining chunks');
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
            logger_js_1.logger.info({ documentId, chunkCount: chunks.length, entityCount: allEntitiesMap.size, requestId }, 'Document ingestion successfully completed');
            const completedDoc = await this.docRepo.findById(documentId);
            return completedDoc || { ...document, status: 'completed', chunkCount: chunks.length };
        }
        catch (err) {
            logger_js_1.logger.error({ documentId, error: err.message, stack: err.stack, requestId }, 'Document ingestion failed');
            await this.docRepo.updateStatus(documentId, 'failed', {
                errorCode: 'INGESTION_ERROR',
                errorMessage: err.message || 'An error occurred during ingestion.',
            });
            throw err;
        }
    }
    async reprocessDocument(documentId, requestId) {
        const doc = await this.docRepo.findById(documentId);
        if (!doc) {
            throw new Error(`Document with ID "${documentId}" not found.`);
        }
        // Reset status to processing and remove prior graph nodes for this document
        await this.docRepo.updateStatus(documentId, 'processing');
        await this.graphRepo.safeDeleteDocumentGraph(documentId);
        // Re-create from chunks if document text is stored or re-ingest
        logger_js_1.logger.info({ documentId, requestId }, 'Reprocessing document graph');
        return doc;
    }
}
exports.IngestionService = IngestionService;
