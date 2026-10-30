import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Computes a SHA-256 hex hash of the given string or Buffer.
 */
export function sha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generates a random UUID v4.
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Generates a deterministic canonical ID from a namespace and a key.
 * Used for entity canonical ID (e.g. "entity:technology:nodejs")
 */
export function generateDeterministicId(namespace: string, key: string): string {
  const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_');
  const hash = crypto.createHash('sha256').update(`${namespace}:${normalizedKey}`).digest('hex').substring(0, 16);
  return `${namespace}_${hash}`;
}

