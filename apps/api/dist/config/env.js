"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const node_path_1 = __importDefault(require("node:path"));
const zod_1 = require("zod");
// Load environment from project root .env or local .env if present
dotenv_1.default.config({ path: node_path_1.default.resolve(process.cwd(), '.env') });
dotenv_1.default.config({ path: node_path_1.default.resolve(process.cwd(), '../../.env') });
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().default(4000),
    WEB_ORIGIN: zod_1.z.string().default('http://localhost:3000'),
    // Groq LLM Configuration
    GROQ_API_KEY: zod_1.z.string().optional().default(''),
    GROQ_MODEL: zod_1.z.string().default('llama-3.3-70b-versatile'),
    // Neo4j Configuration
    NEO4J_URI: zod_1.z.string().default('bolt://localhost:7687'),
    NEO4J_USERNAME: zod_1.z.string().default('neo4j'),
    NEO4J_PASSWORD: zod_1.z.string().default('graphrag_secret_password'),
    NEO4J_DATABASE: zod_1.z.string().default('neo4j'),
    // Embeddings
    EMBEDDING_PROVIDER: zod_1.z.enum(['local-minilm', 'mock']).default('local-minilm'),
    EMBEDDING_MODEL: zod_1.z.string().default('all-MiniLM-L6-v2'),
    EMBEDDING_DIMENSION: zod_1.z.coerce.number().default(384),
    // Ingestion limits
    MAX_UPLOAD_MB: zod_1.z.coerce.number().default(10),
    CHUNK_SIZE: zod_1.z.coerce.number().default(1000),
    CHUNK_OVERLAP: zod_1.z.coerce.number().default(150),
    // GraphRAG Retrieval parameters
    RETRIEVAL_TOP_K: zod_1.z.coerce.number().default(8),
    GRAPH_MAX_HOPS: zod_1.z.coerce.number().default(2),
    MAX_CONTEXT_TOKENS: zod_1.z.coerce.number().default(3000),
});
let parsedConfig;
try {
    parsedConfig = envSchema.parse(process.env);
}
catch (error) {
    if (error instanceof zod_1.z.ZodError) {
        const formattedErrors = error.errors
            .map((err) => `${err.path.join('.')}: ${err.message}`)
            .join('\n');
        console.error('Invalid environment variables:\n' + formattedErrors);
    }
    throw error;
}
exports.config = parsedConfig;
