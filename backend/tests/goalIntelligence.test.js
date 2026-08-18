/**
 * Test Suite - EDOT Goal Intelligence & Dynamic Learning Roadmaps Engine
 * Verifies goal definition, required skill mapping, skill gap analysis, milestone generation,
 * disclaimer enforcement, and goal modification.
 */

import { calculateDynamicRoadmap } from '../src/intelligence/goals/goalRoadmapCalculator.js';
import { createOrUpdateGoal, getLearnerActiveGoalAndRoadmap, modifyGoal } from '../src/intelligence/goals/goalService.js';
import { prisma } from '../lib/prisma.js';

async function runGoalIntelligenceTestSuite() {
  console.log('🧪 Starting EDOT Goal Intelligence Engine Test Suite...\n');

  try {
    // 1. Calculator Unit Test
    console.log('--- 1. Testing Dynamic Learning Roadmap Calculation ---');
    const roadmapData = calculateDynamicRoadmap('Become a Frontend Developer', [
      { name: 'HTML', masteryScore: 85 }
    ]);

    console.log('Roadmap Output:', JSON.stringify(roadmapData, null, 2));

    const hasDisclaimer = roadmapData.disclaimer.includes('non-guaranteed');
    const hasMilestones = roadmapData.milestones.length >= 2;

    if (roadmapData.goal && hasDisclaimer && hasMilestones && roadmapData.skillGaps) {
      console.log('✅ Dynamic roadmap calculation & non-guarantee disclaimer PASSED');
    } else {
      throw new Error('Roadmap calculation test failed');
    }

    // 2. Integration Test: Goal Creation & Active Roadmap Retrieval
    console.log('\n--- 2. Testing Goal Creation & Active Roadmap Retrieval ---');
    const testStudent = await prisma.user.findFirst({ where: { role: 'student' } }) || {
      id: '00000000-0000-0000-0000-000000000001'
    };

    const created = await createOrUpdateGoal(testStudent.id, {
      goalText: 'Become a Full-Stack Developer',
      category: 'career'
    });

    console.log(`Created Goal [ID: ${created.goalId}], Goal: "${created.goalText}"`);

    const activeGoal = await getLearnerActiveGoalAndRoadmap(testStudent.id);
    console.log(`Retrieved Active Goal: "${activeGoal.goalText}", Roadmap Steps: ${activeGoal.roadmap.recommendedPath.length}`);

    if (created.goalId && activeGoal.roadmap.disclaimer) {
      console.log('✅ Goal creation & active roadmap retrieval PASSED');
    } else {
      throw new Error('Goal creation test failed');
    }

    // 3. Goal Modification Test
    console.log('\n--- 3. Testing Goal Modification & Roadmap Refresh ---');
    const modified = await modifyGoal(created.goalId, testStudent.id, {
      goalText: 'Become an AI & Machine Learning Specialist',
      category: 'career'
    });

    console.log(`Modified Goal [ID: ${modified.goalId}], New Goal: "${modified.goalText}"`);

    if (modified.goalText === 'Become an AI & Machine Learning Specialist' && modified.roadmap.id) {
      console.log('✅ Goal modification & roadmap refresh PASSED');
    } else {
      throw new Error('Goal modification test failed');
    }

    console.log('\n🎉 ALL GOAL INTELLIGENCE & DYNAMIC ROADMAP TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runGoalIntelligenceTestSuite();
