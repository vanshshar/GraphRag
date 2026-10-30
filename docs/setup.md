# GraphRAG Setup & Operation Guide

## 1. Prerequisites

- **Node.js**: v20+ or v22+ (v24 supported)
- **Docker & Docker Compose**: v24+ for running Neo4j Community Edition
- **Groq API Key**: Obtain a free API key at [https://console.groq.com/keys](https://console.groq.com/keys)

---

## 2. Quickstart

### Step 1: Clone and Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` and provide your Groq API key:
```ini
GROQ_API_KEY=gsk_your_actual_key_here
GROQ_MODEL=llama-3.3-70b-versatile

NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=graphrag_secret_password

EMBEDDING_PROVIDER=local-minilm
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

### Step 2: Start Neo4j with Docker Compose
```bash
npm run docker:up
```
Verify Neo4j is running:
- Neo4j Browser UI: [http://localhost:7474](http://localhost:7474) (Username: `neo4j`, Password: `graphrag_secret_password`)
- Bolt protocol: `bolt://localhost:7687`

### Step 3: Run the API and Web Frontend
In terminal 1 (API Server on port 4000):
```bash
npm run dev:api
```

In terminal 2 (Web UI on port 3000):
```bash
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. Database Maintenance & Reset

### Resetting Neo4j Data
To purge the database and reset to a clean state:
```bash
# Stop and remove containers and persistent volumes
docker compose -f infra/docker-compose.yml down -v

# Restart fresh Neo4j
docker compose -f infra/docker-compose.yml up -d
```

### Inspecting Neo4j Logs
```bash
npm run docker:logs
```

---

## 4. Automated Testing & Verification

Run backend unit and integration test suite:
```bash
npm run test:api
```

Run TypeScript compilation check:
```bash
npm run build
```

