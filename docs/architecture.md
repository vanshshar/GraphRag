# GraphRAG Architecture

## 1. Executive Overview

GraphRAG is an evidence-grounded Retrieval-Augmented Generation application that combines:
- **Neo4j Property Knowledge Graph** for explicit multi-hop relationship modeling and provenance tracking.
- **Dense Vector Embeddings** (384-dimensional unit-normalized) for semantic similarity.
- **Lexical Matching** for exact term and alias resolution.
- **Groq LLM Inference** (`groq-sdk`) for fast extraction and structured answer generation.
- **Server-Side Citation Verification** to guarantee zero hallucinated citations.

```
                           +--------------------------+
                           |   Next.js React Web UI   |
                           +------------+-------------+
                                        | (HTTP / REST)
                                        v
                           +--------------------------+
                           |  Express TypeScript API  |
                           +------------+-------------+
                                        |
       +--------------------------------+--------------------------------+
       |                                |                                |
       v                                v                                v
+---------------+              +-----------------+              +------------------+
| Neo4j Graph DB|              | Groq LLM Engine |              | Embedding Engine |
| - Document    |              | - Entity Extract|              | - 384d Dense Vec |
| - Chunk       |              | - Claim Extract |              | - Fast Cosine    |
| - Entity      |              | - Grounded Ans  |              | - Local/Offline  |
| - Claim       |              +-----------------+              +------------------+
+---------------+
```

---

## 2. Provenance-Aware Knowledge Graph Model

Neo4j relationships cannot directly have edge-to-node relationships without intermediate nodes. To support multi-document provenance and contradictory evidence, the graph uses an explicit `Claim` node architecture:

```
(:Document { id, title, contentHash, status, chunkCount })
     |
  [:HAS_CHUNK]
     v
(:Chunk { id, index, text, tokenEstimate, contentHash, embedding }) <--+
     |                                                                 |
 [:MENTIONS]                                                     [:SUPPORTED_BY]
     v                                                                 |
(:Entity { canonicalName, normalizedName, type, aliases })             |
     |                                                                 |
 [:SUBJECT_OF]                                                         |
     v                                                                 |
(:Claim { id, predicate, evidence, confidence, extractionVersion }) ---+
     |
 [:OBJECT_OF]
     v
(:Entity { canonicalName, normalizedName, type, aliases })
```

### Graph Rules:
1. **Uniqueness Constraints**:
   - `Document.id`, `Chunk.id`, `Entity.id`, `Claim.id`.
2. **Canonical Entity Resolution**:
   - Entity identities are derived solely from normalized canonical name and type (`entity:<type>:<normName>`). They never embed document IDs or titles.
   - Prevents duplicate entity nodes when the same entity is mentioned across multiple documents.
3. **Safe Deletion**:
   - When a document is deleted, only its owned `Chunk` nodes and isolated document claims are deleted.
   - Shared entities and shared claims with remaining `SUPPORTED_BY` links to other documents are preserved.

---

## 3. Hybrid Retrieval Pipeline

Given a user query:

1. **Query Normalization & Keyword Extraction**: Extracts entities, capitalized concepts, and non-stop words.
2. **Entity Lookup**: Matches query terms against `Entity.normalizedName` and `Entity.aliases`.
3. **Bounded Graph Traversal**:
   - Starting from matched entities, traverses `[:SUBJECT_OF|OBJECT_OF]` up to `maxHops` (default: 2) with a strict result limit (default: 25).
   - Identifies candidate chunks via `[:SUPPORTED_BY]` links.
4. **Lexical Search**:
   - Searches for chunk texts containing query keywords.
5. **Semantic Similarity**:
   - Generates 384-dimensional question vector using the same embedding model.
   - Computes cosine similarity with chunk embeddings.
6. **Candidate Ranking**:
   $$Score = 0.5 \times SemanticScore + 0.3 \times LexicalScore + 0.2 \times GraphScore$$
7. **Context-Budget Management**:
   - Deduplicates candidate chunks.
   - Assembles the top chunks up to `maxContextTokens` (default: 3000 tokens) with document titles and graph context facts.

---

## 4. Grounded Answering & Server-Side Citation Verification

To prevent AI hallucination:
1. The LLM is instructed via a prompt-injection-resistant system prompt to answer using **only** provided evidence passages and return a structured JSON response `{ answer, citations: [{ evidenceId, quote }] }`.
2. **The server rigorously validates every citation ID against the set of chunks actually provided in that specific retrieval call**.
3. Any citation referencing an unknown ID or hallucinated ID is discarded server-side.
4. Valid citation IDs are mapped to trusted source document metadata (title, page number, section, and excerpt) before returning to the user.
5. If evidence is insufficient, the system returns `insufficientEvidence: true` and an explicit disclaimer.

