/**
 * EDOT Intelligence Domain - Prerequisite Gap Service (Phase 9)
 * 
 * Traces Phase 8 Knowledge Graph prerequisite relationships to identify potential
 * prerequisite gaps when students struggle with advanced concepts.
 */

import { prisma } from '../../../lib/prisma.js';
import { getNodePrerequisites } from '../knowledge/prerequisiteService.js';

/**
 * Identifies prerequisite concept gaps for a student and target concept node.
 * 
 * @param {string} studentId 
 * @param {string} targetNodeId 
 */
export async function identifyPrerequisiteGaps(studentId, targetNodeId) {
  const targetNode = await prisma.knowledgeNode.findUnique({ where: { id: targetNodeId } });
  if (!targetNode) {
    return { studentId, targetNodeId, hasPrerequisiteGap: false, gaps: [] };
  }

  // 1. Trace outgoing/incoming prerequisite nodes via Phase 8 Knowledge Graph
  const prereqs = await getNodePrerequisites(targetNodeId);
  if (prereqs.length === 0) {
    return {
      studentId,
      targetNodeId,
      targetNodeName: targetNode.name,
      hasPrerequisiteGap: false,
      gaps: []
    };
  }

  // 2. Fetch student's mastery records for these prerequisite nodes
  const prereqIds = prereqs.map(p => p.id);
  const prereqMasteries = await prisma.learnerConceptMastery.findMany({
    where: { userId: studentId, nodeId: { in: prereqIds } },
    include: { node: true }
  });

  const masteryMap = new Map();
  prereqMasteries.forEach(m => masteryMap.set(m.nodeId, m));

  const gapNodes = [];
  for (const prereq of prereqs) {
    const record = masteryMap.get(prereq.id);
    const state = record ? record.masteryState : 'UNKNOWN';

    if (state === 'UNKNOWN' || state === 'LEARNING' || state === 'DEVELOPING' || state === 'NEEDS_REINFORCEMENT') {
      gapNodes.push({
        prerequisiteNodeId: prereq.id,
        prerequisiteName: prereq.name,
        prerequisiteType: prereq.type,
        currentMasteryState: state,
        evidenceSummary: record ? `Evaluated over ${record.evidenceCount} evidence signals.` : 'Insufficient prior exposure evidence recorded.'
      });
    }
  }

  const hasPrerequisiteGap = gapNodes.length > 0;
  const evidenceSummary = hasPrerequisiteGap
    ? `Performance difficulty on "${targetNode.name}" may be related to ${gapNodes.length} prerequisite concept(s) requiring reinforcement.`
    : `All ${prereqs.length} prerequisite concept foundations show satisfactory evidence.`;

  return {
    studentId,
    targetNodeId,
    targetNodeName: targetNode.name,
    hasPrerequisiteGap,
    prerequisiteCount: prereqs.length,
    gapCount: gapNodes.length,
    gaps: gapNodes,
    evidenceSummary
  };
}
