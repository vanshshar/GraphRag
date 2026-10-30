# GraphRAG REST API Reference

Base URL: `http://localhost:4000`  
API Version: `v1`  
All responses adhere to standardized JSON envelopes.

---

## 1. Health Endpoints

### Process Liveness
- **Route**: `GET /health/live`
- **Response**: `200 OK`
```json
{
  "status": "ok",
  "uptime": 12.4,
  "timestamp": "2026-10-30T12:00:00.000Z"
}
```

### Dependency Readiness
- **Route**: `GET /health/ready`
- **Response**: `200 OK` (when dependencies reachable) or `503 Service Unavailable`
```json
{
  "status": "ready",
  "dependencies": {
    "neo4j": { "ready": true },
    "llm": { "ready": true, "provider": "groq", "model": "llama-3.3-70b-versatile" },
    "embeddings": { "ready": true, "provider": "local-minilm", "model": "all-MiniLM-L6-v2" }
  },
  "timestamp": "2026-10-30T12:00:00.000Z"
}
```

---

## 2. Document Management

### Upload / Ingest Document
- **Route**: `POST /api/v1/documents`
- **Content-Type**: `multipart/form-data` with `file` OR `application/json` with `{ "title": "...", "text": "..." }`
- **Response**: `201 Created`
```json
{
  "documentId": "4892ad92-8db4-4696-a05e-a6a9b40bc43f",
  "title": "Architecture Guide",
  "status": "completed",
  "chunkCount": 3,
  "createdAt": "2026-10-30T12:00:00.000Z"
}
```

### List Documents
- **Route**: `GET /api/v1/documents?page=1&limit=20&search=...`
- **Response**: `200 OK`
```json
{
  "documents": [
    {
      "id": "4892ad92-8db4-4696-a05e-a6a9b40bc43f",
      "title": "Architecture Guide",
      "originalFilename": "arch.md",
      "mimeType": "text/markdown",
      "fileSize": 4096,
      "contentHash": "5a7b...",
      "status": "completed",
      "chunkCount": 3,
      "createdAt": "2026-10-30T12:00:00.000Z",
      "updatedAt": "2026-10-30T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### Get Document Details
- **Route**: `GET /api/v1/documents/:id`
- **Response**: `200 OK`
```json
{
  "document": {
    "id": "4892ad92-8db4-4696-a05e-a6a9b40bc43f",
    "title": "Architecture Guide",
    "status": "completed",
    "chunkCount": 3
  }
}
```

### Delete Document (Safe Deletion)
- **Route**: `DELETE /api/v1/documents/:id`
- **Response**: `204 No Content`
- *Note*: Deletes document-owned chunks and isolated claims; preserves shared entities and claims referenced by other documents.

### Reprocess Document
- **Route**: `POST /api/v1/documents/:id/reprocess`
- **Response**: `200 OK`

---

## 3. Grounded Question Answering

### Query Knowledge Graph
- **Route**: `POST /api/v1/chat/query`
- **Request Body**:
```json
{
  "question": "What web framework is built on Node.js?",
  "topK": 8,
  "maxHops": 2
}
```
- **Response**: `200 OK`
```json
{
  "answer": "Express.js is a minimal and flexible web application framework built on Node.js.",
  "citations": [
    {
      "evidenceId": "chunk_4892ad92-8db4-4696-a05e-a6a9b40bc43f_0",
      "quote": "Express.js is a minimal and flexible Node.js web application framework.",
      "documentTitle": "Architecture Guide",
      "documentId": "4892ad92-8db4-4696-a05e-a6a9b40bc43f",
      "chunkId": "chunk_4892ad92-8db4-4696-a05e-a6a9b40bc43f_0",
      "pageNumber": 1,
      "section": "Frameworks"
    }
  ],
  "insufficientEvidence": false,
  "requestId": "2e061806-ea78-438f-a9cb-6aa76d0fffa9",
  "timingMs": 425,
  "retrievedCount": 6
}
```

---

## 4. Graph Statistics

### Get Metrics
- **Route**: `GET /api/v1/graph/stats`
- **Response**: `200 OK`
```json
{
  "stats": {
    "documentCount": 5,
    "chunkCount": 42,
    "entityCount": 87,
    "claimCount": 114
  }
}
```

