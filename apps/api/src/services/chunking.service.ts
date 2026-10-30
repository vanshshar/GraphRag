import { sha256 } from '../utils/crypto.js';
import type { ChunkModel } from '../schemas/document.schema.js';

export interface ChunkingOptions {
  chunkSize: number;
  chunkOverlap: number;
}

export class ChunkingService {
  /**
   * Splits normalized text into overlapping chunks.
   * Recognizes section headers when present (e.g. # Header or ## Header).
   */
  public static chunkText(
    documentId: string,
    rawText: string,
    options: ChunkingOptions
  ): ChunkModel[] {
    const { chunkSize, chunkOverlap } = options;
    const normalized = rawText.replace(/\r\n/g, '\n').trim();

    if (!normalized) {
      return [];
    }

    if (normalized.length <= chunkSize) {
      return [
        {
          id: `chunk_${documentId}_0`,
          documentId,
          index: 0,
          text: normalized,
          tokenEstimate: Math.ceil(normalized.length / 4),
          contentHash: sha256(normalized),
          pageNumber: 1,
          section: this.extractSectionHeader(normalized),
        },
      ];
    }

    const chunks: ChunkModel[] = [];
    let start = 0;
    let index = 0;

    while (start < normalized.length) {
      let end = start + chunkSize;

      // Prefer breaking at paragraph or sentence boundaries if within range
      if (end < normalized.length) {
        const slice = normalized.substring(start, end);
        const lastPara = slice.lastIndexOf('\n\n');
        const lastSentence = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('? '), slice.lastIndexOf('! '));

        if (lastPara > chunkSize * 0.6) {
          end = start + lastPara + 2;
        } else if (lastSentence > chunkSize * 0.6) {
          end = start + lastSentence + 2;
        }
      } else {
        end = normalized.length;
      }

      const chunkText = normalized.substring(start, end).trim();

      if (chunkText.length > 0) {
        chunks.push({
          id: `chunk_${documentId}_${index}`,
          documentId,
          index,
          text: chunkText,
          tokenEstimate: Math.ceil(chunkText.length / 4),
          contentHash: sha256(chunkText),
          pageNumber: 1,
          section: this.extractSectionHeader(chunkText),
        });
        index++;
      }

      if (end >= normalized.length) {
        break;
      }

      // Slide window by chunkSize - chunkOverlap
      start = Math.max(start + 1, end - chunkOverlap);
    }

    return chunks;
  }

  private static extractSectionHeader(text: string): string | null {
    const headerMatch = text.match(/^(?:#+\s*([^\n]+)|([A-Z0-9\s-]{3,50})\n={3,})/m);
    if (headerMatch) {
      return (headerMatch[1] || headerMatch[2] || '').trim();
    }
    return null;
  }
}

