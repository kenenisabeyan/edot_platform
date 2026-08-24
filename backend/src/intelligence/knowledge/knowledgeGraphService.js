/**
 * EDOT Intelligence Domain - Knowledge Graph Service
 * 
 * Manages KnowledgeNodes (Concepts, Skills, Topics, Competencies, Learning Objectives),
 * taxonomy mapping, and normalized node lookups.
 */

import { prisma } from '../../../lib/prisma.js';
import { normalizeConceptName, computeSimilarity } from './conceptNormalization.js';

/**
 * Finds or creates a KnowledgeNode safely using normalized matching.
 * 
 * @param {object} params
 * @param {string} params.name
 * @param {string} [params.type='CONCEPT']
 * @param {string} [params.description]
 * @param {string} [params.domain]
 * @param {string} [params.category]
 */
export async function findOrCreateKnowledgeNode({ name, type = 'CONCEPT', description = null, domain = null, category = null }) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('KnowledgeNode name is required.');
  }

  const normalized = normalizeConceptName(name);

  // 1. Exact normalized match check
  let existingNode = await prisma.knowledgeNode.findFirst({
    where: { normalizedName: normalized, status: 'ACTIVE' }
  });

  if (existingNode) return existingNode;

  // 2. High-confidence similarity match check across active nodes
  const activeNodes = await prisma.knowledgeNode.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, normalizedName: true }
  });

  for (const node of activeNodes) {
    const similarity = computeSimilarity(normalized, node.normalizedName);
    if (similarity >= 0.85) {
      return prisma.knowledgeNode.findUnique({ where: { id: node.id } });
    }
  }

  // 3. Create new KnowledgeNode
  return prisma.knowledgeNode.create({
    data: {
      name: name.trim(),
      normalizedName: normalized,
      type: type.toUpperCase(),
      description,
      domain,
      category,
      status: 'ACTIVE'
    }
  });
}

/**
 * Retrieves a KnowledgeNode by ID with related graph edges.
 * 
 * @param {string} nodeId 
 */
export async function getKnowledgeNodeById(nodeId) {
  const node = await prisma.knowledgeNode.findUnique({
    where: { id: nodeId },
    include: {
      outgoingRelations: {
        where: { reviewStatus: 'APPROVED' },
        include: { targetNode: true }
      },
      incomingRelations: {
        where: { reviewStatus: 'APPROVED' },
        include: { sourceNode: true }
      },
      contentMappings: {
        where: { reviewStatus: { in: ['APPROVED', 'AUTO_DETECTED'] } },
        include: { course: { select: { id: true, title: true } }, lesson: { select: { id: true, title: true } } }
      }
    }
  });

  if (!node) {
    throw new Error(`KnowledgeNode not found with ID "${nodeId}".`);
  }

  return node;
}

/**
 * Gets all active KnowledgeNodes with optional filters.
 * 
 * @param {object} [filters] 
 */
export async function getKnowledgeNodes({ type = null, category = null, domain = null, search = null } = {}) {
  const where = { status: 'ACTIVE' };

  if (type) where.type = type.toUpperCase();
  if (category) where.category = category;
  if (domain) where.domain = domain;
  if (search) where.normalizedName = { contains: normalizeConceptName(search) };

  return prisma.knowledgeNode.findMany({
    where,
    orderBy: { name: 'asc' },
    take: 100
  });
}
