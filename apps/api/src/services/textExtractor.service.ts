import pdfParse from 'pdf-parse';
import { ValidationError } from '../middleware/errorHandler.js';

export interface ExtractedDocumentContent {
  text: string;
  pageCount?: number;
}

export class TextExtractorService {
  public static async extract(
    buffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<ExtractedDocumentContent> {
    const ext = filename.toLowerCase().split('.').pop() || '';

    // Plain text / Markdown / CSV / JSON
    if (
      mimeType.startsWith('text/') ||
      ext === 'txt' ||
      ext === 'md' ||
      ext === 'markdown' ||
      ext === 'csv'
    ) {
      const text = buffer.toString('utf-8').trim();
      if (!text) {
        throw new ValidationError(`The file "${filename}" is empty.`);
      }
      return { text };
    }

    // JSON file
    if (mimeType === 'application/json' || ext === 'json') {
      try {
        const text = buffer.toString('utf-8').trim();
        const json = JSON.parse(text);
        const formatted = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
        if (!formatted || formatted === '{}') {
          throw new ValidationError(`The JSON file "${filename}" contains no content.`);
        }
        return { text: formatted };
      } catch (err: any) {
        throw new ValidationError(`Invalid JSON file "${filename}": ${err.message}`);
      }
    }

    // PDF files
    if (mimeType === 'application/pdf' || ext === 'pdf') {
      try {
        const data = await pdfParse(buffer);
        const text = (data.text || '').trim();
        if (!text) {
          throw new ValidationError(
            `Unable to extract text from "${filename}". The PDF might be scanned or image-only.`
          );
        }
        return {
          text,
          pageCount: data.numpages,
        };
      } catch (err: any) {
        throw new ValidationError(`Failed to parse PDF document "${filename}": ${err.message}`);
      }
    }

    throw new ValidationError(
      `Unsupported file type for "${filename}". Supported formats: .txt, .md, .json, .csv, .pdf`
    );
  }
}

