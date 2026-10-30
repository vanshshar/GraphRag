import neo4j, { type Driver, type Session } from 'neo4j-driver';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

let driverInstance: Driver | null = null;

export function getNeo4jDriver(): Driver {
  if (!driverInstance) {
    logger.info({ uri: config.NEO4J_URI }, 'Initializing Neo4j driver');
    driverInstance = neo4j.driver(
      config.NEO4J_URI,
      neo4j.auth.basic(config.NEO4J_USERNAME, config.NEO4J_PASSWORD),
      {
        maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 10000, // 10 seconds
        logging: {
          level: 'warn',
          logger: (level, message) => {
            if (level === 'error') logger.error({ message }, 'Neo4j driver error');
          },
        },
      }
    );
  }
  return driverInstance;
}

export async function verifyNeo4jConnectivity(): Promise<boolean> {
  let session: Session | null = null;
  try {
    const driver = getNeo4jDriver();
    session = driver.session({ database: config.NEO4J_DATABASE });
    const result = await session.run('RETURN 1 AS ping');
    return result.records.length > 0 && result.records[0].get('ping').toNumber() === 1;
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Neo4j connectivity check failed');
    return false;
  } finally {
    if (session) {
      await session.close();
    }
  }
}

export async function initializeNeo4jSchema(): Promise<void> {
  const driver = getNeo4jDriver();
  const session = driver.session({ database: config.NEO4J_DATABASE });

  try {
    logger.info('Ensuring Neo4j uniqueness constraints and indexes...');

    const statements = [
      // Uniqueness constraints
      'CREATE CONSTRAINT doc_id_unique IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE',
      'CREATE CONSTRAINT chunk_id_unique IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE',
      'CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE',
      'CREATE CONSTRAINT claim_id_unique IF NOT EXISTS FOR (cl:Claim) REQUIRE cl.id IS UNIQUE',

      // Lookup and search indexes
      'CREATE INDEX entity_normalized_name_idx IF NOT EXISTS FOR (e:Entity) ON (e.normalizedName)',
      'CREATE INDEX entity_canonical_name_idx IF NOT EXISTS FOR (e:Entity) ON (e.canonicalName)',
      'CREATE INDEX doc_status_idx IF NOT EXISTS FOR (d:Document) ON (d.status)',
      'CREATE INDEX chunk_doc_id_idx IF NOT EXISTS FOR (c:Chunk) ON (c.documentId)',
    ];

    for (const query of statements) {
      try {
        await session.run(query);
      } catch (err: any) {
        logger.warn({ query, error: err.message }, 'Notice when creating index or constraint');
      }
    }

    logger.info('Neo4j constraints and indexes successfully verified');
  } finally {
    await session.close();
  }
}

export async function closeNeo4jDriver(): Promise<void> {
  if (driverInstance) {
    logger.info('Closing Neo4j driver');
    await driverInstance.close();
    driverInstance = null;
  }
}

