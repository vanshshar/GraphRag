import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

// Load environment from project root .env or local .env if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),

  // Groq LLM Configuration
  GROQ_API_KEY: z.string().optional().default(''),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),

  // Neo4j Configuration
  NEO4J_URI: z.string().default('bolt://localhost:7687'),
  NEO4J_USERNAME: z.string().default('neo4j'),
  NEO4J_PASSWORD: z.string().default('graphrag_secret_password'),
  NEO4J_DATABASE: z.string().default('neo4j'),

  // Embeddings
  EMBEDDING_PROVIDER: z.enum(['local-minilm', 'mock']).default('local-minilm'),
  EMBEDDING_MODEL: z.string().default('all-MiniLM-L6-v2'),
  EMBEDDING_DIMENSION: z.coerce.number().default(384),

  // Ingestion limits
  MAX_UPLOAD_MB: z.coerce.number().default(10),
  CHUNK_SIZE: z.coerce.number().default(1000),
  CHUNK_OVERLAP: z.coerce.number().default(150),

  // GraphRAG Retrieval parameters
  RETRIEVAL_TOP_K: z.coerce.number().default(8),
  GRAPH_MAX_HOPS: z.coerce.number().default(2),
  MAX_CONTEXT_TOKENS: z.coerce.number().default(3000),
});

export type EnvConfig = z.infer<typeof envSchema>;

let parsedConfig: EnvConfig;

try {
  parsedConfig = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const formattedErrors = error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join('\n');
    console.error('Invalid environment variables:\n' + formattedErrors);
  }
  throw error;
}

export const config = parsedConfig;

