/**
 * EDOT Intelligence Domain - Decoupled Search Architecture Service
 * Provider-agnostic search indexer and query manager over courses, lessons, skills, projects, and opportunities.
 */

import { prisma } from '../../../lib/prisma.js';

/**
 * Indexes an entity in the decoupled search index store.
 */
export async function indexSearchRecord(entityType, entityId, searchTokens, contentPayload = {}) {
  return prisma.searchIndexRecord.create({
    data: {
      entityType,
      entityId,
      searchTokens: searchTokens.toLowerCase(),
      contentPayload
    }
  });
}

/**
 * Executes a search query over the provider-agnostic search index.
 */
export async function searchEntities(queryText, entityType = null, limit = 20) {
  const token = queryText.toLowerCase().trim();

  const whereClause = {
    searchTokens: { contains: token }
  };
  if (entityType) {
    whereClause.entityType = entityType;
  }

  const results = await prisma.searchIndexRecord.findMany({
    where: whereClause,
    take: limit,
    orderBy: { indexedAt: 'desc' }
  });

  return results.map(r => ({
    entityType: r.entityType,
    entityId: r.entityId,
    contentPayload: r.contentPayload,
    indexedAt: r.indexedAt
  }));
}
