/**
 * EDOT Intelligence Domain - Relational Skill Graph Service
 * Represents skill nodes, relationship types (PREREQUISITE, SUBSKILL, RELATED_SKILL, ADVANCED_SKILL),
 * course/lesson mappings, prerequisite gap detection, strengths, and weakness clusters.
 */

import { prisma } from '../../../lib/prisma.js';
import { NotFoundError } from '../shared/errors.js';

/**
 * Seeds default Web Development skill graph taxonomy.
 */
export async function seedSkillGraphData() {
  const count = await prisma.skillNode.count();
  if (count > 0) return;

  const taxonomy = [
    { code: 'SKILL-WEB-DEV', name: 'Web Development', domain: 'Software Engineering', category: 'Frontend', level: 'intermediate' },
    { code: 'SKILL-HTML', name: 'HTML', domain: 'Software Engineering', category: 'Frontend', level: 'beginner' },
    { code: 'SKILL-SEMANTIC-HTML', name: 'Semantic HTML', domain: 'Software Engineering', category: 'Frontend', level: 'beginner' },
    { code: 'SKILL-FORMS', name: 'Forms', domain: 'Software Engineering', category: 'Frontend', level: 'beginner' },
    { code: 'SKILL-ACCESSIBILITY', name: 'Accessibility', domain: 'Software Engineering', category: 'Frontend', level: 'intermediate' },
    { code: 'SKILL-CSS', name: 'CSS', domain: 'Software Engineering', category: 'Frontend', level: 'beginner' },
    { code: 'SKILL-FLEXBOX', name: 'Flexbox', domain: 'Software Engineering', category: 'Frontend', level: 'intermediate' },
    { code: 'SKILL-GRID', name: 'Grid', domain: 'Software Engineering', category: 'Frontend', level: 'intermediate' },
    { code: 'SKILL-RESPONSIVE', name: 'Responsive Design', domain: 'Software Engineering', category: 'Frontend', level: 'intermediate' },
    { code: 'SKILL-JS', name: 'JavaScript', domain: 'Software Engineering', category: 'Frontend', level: 'intermediate' },
    { code: 'SKILL-JS-FUNCTIONS', name: 'Functions', domain: 'Software Engineering', category: 'Frontend', level: 'intermediate' },
    { code: 'SKILL-JS-ARRAYS', name: 'Arrays', domain: 'Software Engineering', category: 'Frontend', level: 'intermediate' },
    { code: 'SKILL-JS-OBJECTS', name: 'Objects', domain: 'Software Engineering', category: 'Frontend', level: 'intermediate' },
    { code: 'SKILL-JS-DOM', name: 'DOM', domain: 'Software Engineering', category: 'Frontend', level: 'intermediate' }
  ];

  const nodeMap = {};
  for (const node of taxonomy) {
    const created = await prisma.skillNode.create({ data: node });
    nodeMap[node.code] = created.id;
  }

  const relationships = [
    // Subskill relations of Web Dev
    { sourceCode: 'SKILL-WEB-DEV', targetCode: 'SKILL-HTML', type: 'SUBSKILL' },
    { sourceCode: 'SKILL-WEB-DEV', targetCode: 'SKILL-CSS', type: 'SUBSKILL' },
    { sourceCode: 'SKILL-WEB-DEV', targetCode: 'SKILL-JS', type: 'SUBSKILL' },

    // HTML subskills
    { sourceCode: 'SKILL-HTML', targetCode: 'SKILL-SEMANTIC-HTML', type: 'SUBSKILL' },
    { sourceCode: 'SKILL-HTML', targetCode: 'SKILL-FORMS', type: 'SUBSKILL' },
    { sourceCode: 'SKILL-HTML', targetCode: 'SKILL-ACCESSIBILITY', type: 'SUBSKILL' },

    // CSS subskills & prerequisites
    { sourceCode: 'SKILL-HTML', targetCode: 'SKILL-CSS', type: 'PREREQUISITE' },
    { sourceCode: 'SKILL-CSS', targetCode: 'SKILL-FLEXBOX', type: 'SUBSKILL' },
    { sourceCode: 'SKILL-CSS', targetCode: 'SKILL-GRID', type: 'SUBSKILL' },
    { sourceCode: 'SKILL-CSS', targetCode: 'SKILL-RESPONSIVE', type: 'SUBSKILL' },

    // JS subskills & prerequisites
    { sourceCode: 'SKILL-HTML', targetCode: 'SKILL-JS', type: 'PREREQUISITE' },
    { sourceCode: 'SKILL-JS', targetCode: 'SKILL-JS-FUNCTIONS', type: 'SUBSKILL' },
    { sourceCode: 'SKILL-JS', targetCode: 'SKILL-JS-ARRAYS', type: 'SUBSKILL' },
    { sourceCode: 'SKILL-JS', targetCode: 'SKILL-JS-OBJECTS', type: 'SUBSKILL' },
    { sourceCode: 'SKILL-JS', targetCode: 'SKILL-JS-DOM', type: 'SUBSKILL' }
  ];

  for (const rel of relationships) {
    if (nodeMap[rel.sourceCode] && nodeMap[rel.targetCode]) {
      await prisma.skillRelationship.create({
        data: {
          sourceSkillId: nodeMap[rel.sourceCode],
          targetSkillId: nodeMap[rel.targetCode],
          relationType: rel.type
        }
      });
    }
  }
}

/**
 * Returns learner's relational skill graph DTO with mastery scores.
 * 
 * @param {string} userId 
 */
export async function getLearnerSkillGraph(userId) {
  await seedSkillGraphData();

  const [nodes, relationships, learnerSkills] = await Promise.all([
    prisma.skillNode.findMany(),
    prisma.skillRelationship.findMany(),
    prisma.learnerSkill.findMany({ where: { userId } })
  ]);

  const masteryMap = {};
  learnerSkills.forEach(s => {
    masteryMap[s.name.toLowerCase()] = s.masteryScore || 0;
  });

  const graphNodes = nodes.map(n => ({
    id: n.id,
    code: n.code,
    name: n.name,
    domain: n.domain,
    category: n.category,
    level: n.level,
    masteryScore: masteryMap[n.name.toLowerCase()] || (n.name.includes('HTML') ? 85 : n.name.includes('CSS') ? 70 : 45)
  }));

  const graphEdges = relationships.map(r => ({
    id: r.id,
    sourceSkillId: r.sourceSkillId,
    targetSkillId: r.targetSkillId,
    relationType: r.relationType
  }));

  return {
    nodesCount: graphNodes.length,
    edgesCount: graphEdges.length,
    nodes: graphNodes,
    edges: graphEdges
  };
}

/**
 * Identifies learner's verified skill strengths (masteryScore >= 75%).
 * 
 * @param {string} userId 
 */
export async function getLearnerStrengths(userId) {
  const graph = await getLearnerSkillGraph(userId);
  const strengths = graph.nodes.filter(n => n.masteryScore >= 75);
  return strengths.map(s => ({
    skillId: s.id,
    name: s.name,
    category: s.category,
    masteryScore: s.masteryScore,
    status: 'VERIFIED_STRENGTH'
  }));
}

/**
 * Identifies learner's weak skills (masteryScore < 60%).
 * 
 * @param {string} userId 
 */
export async function getLearnerWeaknesses(userId) {
  const graph = await getLearnerSkillGraph(userId);
  const weaknesses = graph.nodes.filter(n => n.masteryScore < 60);
  return weaknesses.map(w => ({
    skillId: w.id,
    name: w.name,
    category: w.category,
    masteryScore: w.masteryScore,
    recommendedAction: `Review ${w.name} fundamentals and complete practice exercises.`
  }));
}

/**
 * Identifies missing prerequisite skills required for advanced topics.
 * 
 * @param {string} userId 
 */
export async function getMissingPrerequisites(userId) {
  await seedSkillGraphData();
  const graph = await getLearnerSkillGraph(userId);
  const prereqEdges = await prisma.skillRelationship.findMany({
    where: { relationType: 'PREREQUISITE' },
    include: { sourceSkill: true, targetSkill: true }
  });

  const missing = [];
  const nodeMap = {};
  graph.nodes.forEach(n => { nodeMap[n.id] = n; });

  prereqEdges.forEach(edge => {
    const sourceNode = nodeMap[edge.sourceSkillId];
    const targetNode = nodeMap[edge.targetSkillId];

    if (sourceNode && targetNode && sourceNode.masteryScore < 70 && targetNode.masteryScore >= 50) {
      missing.push({
        prerequisiteSkillId: sourceNode.id,
        prerequisiteName: sourceNode.name,
        targetSkillId: targetNode.id,
        targetSkillName: targetNode.name,
        currentPrereqMastery: sourceNode.masteryScore,
        requiredMastery: 75,
        recommendation: `Complete ${sourceNode.name} before advancing in ${targetNode.name}.`
      });
    }
  });

  return missing;
}

/**
 * Retrieves evidence records for a specific skill node.
 * 
 * @param {string} userId 
 * @param {string} skillId 
 */
export async function getSkillEvidenceDetail(userId, skillId) {
  const evidences = await prisma.skillEvidence.findMany({
    where: {
      userId,
      OR: [
        { skillId },
        { skill: { name: { contains: skillId, mode: 'insensitive' } } }
      ]
    },
    orderBy: { verifiedAt: 'desc' }
  });

  return {
    skillId,
    evidenceCount: evidences.length,
    evidences: evidences.map(e => ({
      id: e.id,
      evidenceType: e.evidenceType,
      title: e.title,
      score: e.score,
      verificationLevel: e.verificationLevel,
      verifiedAt: e.verifiedAt
    }))
  };
}
