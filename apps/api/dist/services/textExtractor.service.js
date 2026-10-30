"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextExtractorService = void 0;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
class TextExtractorService {
    static async extract(buffer, mimeType, filename) {
        const ext = filename.toLowerCase().split('.').pop() || '';
        // Plain text / Markdown / CSV / JSON
        if (mimeType.startsWith('text/') ||
            ext === 'txt' ||
            ext === 'md' ||
            ext === 'markdown' ||
            ext === 'csv') {
            const text = buffer.toString('utf-8').trim();
            if (!text) {
                throw new errorHandler_js_1.ValidationError(`The file "${filename}" is empty.`);
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
                    throw new errorHandler_js_1.ValidationError(`The JSON file "${filename}" contains no content.`);
                }
                return { text: formatted };
            }
            catch (err) {
                throw new errorHandler_js_1.ValidationError(`Invalid JSON file "${filename}": ${err.message}`);
            }
        }
        // PDF files
        if (mimeType === 'application/pdf' || ext === 'pdf') {
            try {
                const data = await (0, pdf_parse_1.default)(buffer);
                const text = (data.text || '').trim();
                if (!text) {
                    throw new errorHandler_js_1.ValidationError(`Unable to extract text from "${filename}". The PDF might be scanned or image-only.`);
                }
                return {
                    text,
                    pageCount: data.numpages,
                };
            }
            catch (err) {
                throw new errorHandler_js_1.ValidationError(`Failed to parse PDF document "${filename}": ${err.message}`);
            }
        }
        throw new errorHandler_js_1.ValidationError(`Unsupported file type for "${filename}". Supported formats: .txt, .md, .json, .csv, .pdf`);
    }
}
exports.TextExtractorService = TextExtractorService;
