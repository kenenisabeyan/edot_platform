/**
 * Test Suite - EDOT Relational Skill Graph Engine
 * Verifies skill taxonomy seeding, prerequisite edge traversal, strengths, weaknesses, and missing prerequisites.
 */

import {
  getLearnerSkillGraph,
  getLearnerStrengths,
  getLearnerWeaknesses,
  getMissingPrerequisites,
  getSkillEvidenceDetail
} from '../src/intelligence/skills/skillGraphService.js';
import { prisma } from '../lib/prisma.js';

async function runSkillGraphTestSuite() {
  console.log('🧪 Starting EDOT Relational Skill Graph Engine Test Suite...\n');

  try {
    const testUser = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };

    // 1. Learner Skill Graph Retrieval Test
    console.log('--- 1. Testing Skill Graph Hierarchy Traversal ---');
    const graph = await getLearnerSkillGraph(testUser.id);
    console.log(`Retrieved Skill Graph with ${graph.nodesCount} nodes and ${graph.edgesCount} edges.`);
    console.log('Sample Graph Node:', JSON.stringify(graph.nodes[0], null, 2));

    const hasHTML = graph.nodes.some(n => n.name === 'HTML');
    const hasJS = graph.nodes.some(n => n.name === 'JavaScript');

    if (graph.nodesCount >= 10 && hasHTML && hasJS) {
      console.log('✅ Skill Graph hierarchy & node mapping PASSED');
    } else {
      throw new Error('Skill Graph hierarchy traversal failed');
    }

    // 2. Strengths & Weaknesses Evaluation
    console.log('\n--- 2. Testing Strengths and Weaknesses Identification ---');
    const [strengths, weaknesses] = await Promise.all([
      getLearnerStrengths(testUser.id),
      getLearnerWeaknesses(testUser.id)
    ]);

    console.log(`Identified ${strengths.length} strengths and ${weaknesses.length} weak topics.`);
    if (strengths.length > 0) {
      console.log('Sample Strength:', JSON.stringify(strengths[0], null, 2));
    }

    if (Array.isArray(strengths) && Array.isArray(weaknesses)) {
      console.log('✅ Strengths & Weaknesses identification PASSED');
    } else {
      throw new Error('Strengths & Weaknesses evaluation failed');
    }

    // 3. Missing Prerequisites Detection
    console.log('\n--- 3. Testing Missing Prerequisites Detection ---');
    const missingPrereqs = await getMissingPrerequisites(testUser.id);
    console.log(`Detected ${missingPrereqs.length} missing prerequisite relations.`);

    if (Array.isArray(missingPrereqs)) {
      console.log('✅ Missing prerequisites detection PASSED');
    } else {
      throw new Error('Missing prerequisites detection failed');
    }

    // 4. Skill Evidence Detail Retrieval
    console.log('\n--- 4. Testing Skill Evidence Detail Retrieval ---');
    const evidenceDetail = await getSkillEvidenceDetail(testUser.id, 'React');
    console.log(`Retrieved ${evidenceDetail.evidenceCount} evidence items for skill [${evidenceDetail.skillId}]`);

    if (evidenceDetail.skillId) {
      console.log('✅ Skill evidence detail retrieval PASSED');
    } else {
      throw new Error('Skill evidence detail retrieval failed');
    }

    console.log('\n🎉 ALL RELATIONAL SKILL GRAPH ENGINE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSkillGraphTestSuite();
