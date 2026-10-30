import { describe, it, expect } from 'vitest';
import { EntityResolverService } from '../../src/services/entityResolver.service.js';

describe('EntityResolverService', () => {
  it('normalizes entity names consistently regardless of casing, accents, and whitespace', () => {
    const norm1 = EntityResolverService.normalizeName('  Express.js  ');
    const norm2 = EntityResolverService.normalizeName('EXPRESS.JS');
    expect(norm1).toBe('expressjs');
    expect(norm2).toBe('expressjs');
  });

  it('generates identical stable IDs for identical entity normalized names across documents', () => {
    const entityA = EntityResolverService.resolveEntity({
      name: 'Neo4j Database',
      type: 'Technology',
      aliases: ['Neo4j'],
    });

    const entityB = EntityResolverService.resolveEntity({
      name: 'neo4j database',
      type: 'Technology',
      aliases: ['GraphDB'],
    });

    expect(entityA.id).toBe(entityB.id);
    expect(entityA.normalizedName).toBe('neo4j database');
  });

  it('retains canonical display name and preserves aliases', () => {
    const resolved = EntityResolverService.resolveEntity({
      name: 'TypeScript',
      type: 'Language',
      aliases: ['TS'],
    });

    expect(resolved.canonicalName).toBe('TypeScript');
    expect(resolved.aliases).toContain('TypeScript');
    expect(resolved.aliases).toContain('TS');
  });

  it('prevents merging distinct programming languages despite surface similarity', () => {
    const isJavaAndJsSame = EntityResolverService.areEquivalent('Java', 'JavaScript');
    expect(isJavaAndJsSame).toBe(false);

    const isCAndCppSame = EntityResolverService.areEquivalent('C', 'C++');
    expect(isCAndCppSame).toBe(false);
  });
});

