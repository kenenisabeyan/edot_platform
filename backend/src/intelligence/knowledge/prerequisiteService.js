/**
 * EDOT Intelligence Domain - Prerequisite & Knowledge Relationship Service
 * 
 * Manages relationships between KnowledgeNodes (PREREQUISITE_OF, RELATED_TO, PART_OF, ADVANCES_TO, REINFORCES).
 * Enforces strict validation:
 * 1. Blocks self-relations (A cannot be prerequisite of A).
 * 2. Prevents duplicate edges.
 * 3. Detects and rejects circular prerequisite loops (A -> B -> C -> A) using Depth-First Search (DFS).
 */

import { prisma } from '../../../lib/prisma.js';

/**
 * Checks if adding an edge (sourceNodeId -> targetNodeId) would create a circular dependency.
 * Edge meaning: sourceNodeId IS PREREQUISITE OF targetNodeId.
 * Path: targetNodeId -> ... -> sourceNodeId
 * 
 * @param {string} sourceNodeId 
 * @param {string} targetNodeId 
 * @returns {Promise<boolean>} true if cycle would be formed, false otherwise
 */
export async function hasCircularDependency(sourceNodeId, targetNodeId) {
  if (sourceNodeId === targetNodeId) return true;

  const visited = new Set();
  const queue = [targetNodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === sourceNodeId) return true;

    if (!visited.has(current)) {
      visited.add(current);

      // Fetch outgoing PREREQUISITE_OF edges from current node
      const outgoing = await prisma.knowledgeRelationship.findMany({
        where: {
          sourceNodeId: current,
          relationType: 'PREREQUISITE_OF',
          reviewStatus: { in: ['APPROVED', 'SUGGESTED'] }
        },
        select: { targetNodeId: true }
      });

      for (const edge of outgoing) {
        if (!visited.has(edge.targetNodeId)) {
          queue.push(edge.targetNodeId);
        }
      }
    }
  }

  return false;
}

/**
 * Creates a validated relationship between two KnowledgeNodes.
 * 
 * @param {object} params
 * @param {string} params.sourceNodeId
 * @param {string} params.targetNodeId
 * @param {string} [params.relationType='PREREQUISITE_OF']
 * @param {number} [params.confidence=1.0]
 * @param {string} [params.source='AI_EXTRACTED']
 * @param {string} [params.reviewStatus='APPROVED']
 * @param {string} [params.evidenceSummary]
 */
export async function createKnowledgeRelationship({
  sourceNodeId,
  targetNodeId,
  relationType = 'PREREQUISITE_OF',
  confidence = 1.0,
  source = 'AI_EXTRACTED',
  reviewStatus = 'APPROVED',
  evidenceSummary = null
}) {
  if (!sourceNodeId || !targetNodeId) {
    throw new Error('sourceNodeId and targetNodeId are required.');
  }

  // 1. Block self-references
  if (sourceNodeId === targetNodeId) {
    throw new Error(`Invalid relationship: Node cannot be related to itself (ID "${sourceNodeId}").`);
  }

  // 2. Verify both nodes exist
  const [sourceNode, targetNode] = await Promise.all([
    prisma.knowledgeNode.findUnique({ where: { id: sourceNodeId } }),
    prisma.knowledgeNode.findUnique({ where: { id: targetNodeId } })
  ]);

  if (!sourceNode || !targetNode) {
    throw new Error('Source or target KnowledgeNode does not exist.');
  }

  // 3. Cycle Detection for PREREQUISITE_OF
  if (relationType === 'PREREQUISITE_OF') {
    const isCircular = await hasCircularDependency(sourceNodeId, targetNodeId);
    if (isCircular) {
      throw new Error(`Circular prerequisite dependency detected: Adding prerequisite "${sourceNode.name}" -> "${targetNode.name}" would create a cycle.`);
    }
  }

  // 4. Duplicate edge check
  const existing = await prisma.knowledgeRelationship.findUnique({
    where: {
      sourceNodeId_targetNodeId_relationType: {
        sourceNodeId,
        targetNodeId,
        relationType
      }
    }
  });

  if (existing) {
    return prisma.knowledgeRelationship.update({
      where: { id: existing.id },
      data: { confidence, source, reviewStatus, evidenceSummary, updatedAt: new Date() }
    });
  }

  // 5. Create relationship edge
  return prisma.knowledgeRelationship.create({
    data: {
      sourceNodeId,
      targetNodeId,
      relationType,
      confidence,
      source,
      reviewStatus,
      evidenceSummary
    }
  });
}

/**
 * Gets direct prerequisites for a KnowledgeNode.
 * 
 * @param {string} nodeId 
 */
export async function getNodePrerequisites(nodeId) {
  const incoming = await prisma.knowledgeRelationship.findMany({
    where: {
      targetNodeId: nodeId,
      relationType: 'PREREQUISITE_OF',
      reviewStatus: 'APPROVED'
    },
    include: { sourceNode: true }
  });

  return incoming.map(edge => edge.sourceNode);
}

/**
 * Deletes a knowledge relationship.
 * 
 * @param {string} relationshipId 
 */
export async function deleteKnowledgeRelationship(relationshipId) {
  return prisma.knowledgeRelationship.delete({
    where: { id: relationshipId }
  });
}
