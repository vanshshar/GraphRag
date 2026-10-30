"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockLlmProvider = void 0;
class MockLlmProvider {
    providerName = 'mock';
    modelName = 'mock-llm-v1';
    customExtractionResult;
    customAnswerResponse;
    shouldFail = false;
    async extractEntitiesAndClaims(chunkText) {
        if (this.shouldFail) {
            throw new Error('Mock LLM extraction failure');
        }
        if (this.customExtractionResult) {
            return this.customExtractionResult;
        }
        // Default heuristic extraction for testing
        const entities = [];
        const claims = [];
        if (chunkText.includes('Node.js') || chunkText.includes('Express')) {
            entities.push({
                name: 'Node.js',
                type: 'Technology',
                aliases: ['Node', 'NodeJS'],
            });
            entities.push({
                name: 'Express.js',
                type: 'Framework',
                aliases: ['Express'],
            });
            claims.push({
                subject: 'Express.js',
                predicate: 'BUILT_ON',
                object: 'Node.js',
                evidence: 'Express.js is a web framework built on Node.js.',
                confidence: 0.95,
            });
        }
        else {
            entities.push({
                name: 'SampleEntity',
                type: 'Concept',
                aliases: [],
            });
            claims.push({
                subject: 'SampleEntity',
                predicate: 'RELATES_TO',
                object: 'KnowledgeGraph',
                evidence: chunkText.slice(0, 50),
                confidence: 0.9,
            });
        }
        return { entities, claims };
    }
    async generateGroundedAnswer(question, evidence) {
        if (this.shouldFail) {
            throw new Error('Mock LLM answer failure');
        }
        if (this.customAnswerResponse) {
            return this.customAnswerResponse;
        }
        if (evidence.length === 0) {
            return {
                answer: 'I do not have sufficient information in the indexed documents to answer this question.',
                citations: [],
                insufficientEvidence: true,
            };
        }
        const first = evidence[0];
        return {
            answer: `Based on the documents, regarding "${question}": ${first.chunkText.slice(0, 100)}.`,
            citations: [
                {
                    evidenceId: first.evidenceId,
                    quote: first.chunkText.slice(0, 40),
                },
            ],
            insufficientEvidence: false,
        };
    }
    async healthCheck() {
        return { ok: true, message: 'Mock LLM provider is active' };
    }
}
exports.MockLlmProvider = MockLlmProvider;
