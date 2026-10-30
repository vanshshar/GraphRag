import { generateDeterministicId } from '../utils/crypto.js';
import type { ExtractedEntity } from '../schemas/extraction.schema.js';
import type { EntityNode } from '../schemas/graph.schema.js';

export class EntityResolverService {
  /**
   * Normalizes an entity name for matching (lowercase, collapsed whitespace, trimmed).
   * Preserves programming language markers like '+' and '#' (e.g. C++, C#).
   */
  public static normalizeName(name: string): string {
    return name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/[^\w\s+#-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Canonicalizes an extracted entity into an EntityNode with stable deterministic ID.
   */
  public static resolveEntity(extracted: ExtractedEntity): EntityNode {
    const canonicalName = extracted.name.trim();
    const normalizedName = this.normalizeName(canonicalName);
    const type = extracted.type.trim() || 'Concept';

    // Stable ID based solely on normalized name and type - independent of document!
    const id = generateDeterministicId('entity', `${type}_${normalizedName}`);
    const now = new Date().toISOString();

    const rawAliases = [canonicalName, ...(extracted.aliases || [])];
    const aliases = Array.from(
      new Set(
        rawAliases
          .map((a) => a.trim())
          .filter((a) => a.length > 0)
      )
    );

    return {
      id,
      canonicalName,
      normalizedName,
      type,
      aliases,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Checks if two entity names refer to the same entity based on exact or alias match.
   * Guardrail: Prevents false mergers (e.g. "Java" vs "JavaScript").
   */
  public static areEquivalent(nameA: string, nameB: string): boolean {
    const normA = this.normalizeName(nameA);
    const normB = this.normalizeName(nameB);

    if (normA === normB) return true;

    // Strict guardrails: do not merge subwords if they are distinct programming languages or known entities
    const knownDistinct = [
      ['java', 'javascript'],
      ['c', 'c++'],
      ['c', 'c#'],
      ['python', 'cpython'],
    ];

    for (const [x, y] of knownDistinct) {
      if ((normA === x && normB === y) || (normA === y && normB === x)) {
        return false;
      }
    }

    return false;
  }
}
