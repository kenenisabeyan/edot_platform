/**
 * Test Suite - EDOT Learner Intelligence Profile & Explainable Metrics
 */

import { calculateLearnerMetrics } from '../src/intelligence/profile/profileCalculator.js';
import { syncLearnerProfile, getFullLearnerProfile, upsertSkillNode } from '../src/intelligence/profile/profileService.js';
import { prisma } from '../lib/prisma.js';

async function runLearnerProfileTestSuite() {
  console.log('🧪 Starting EDOT Learner Intelligence Profile Test Suite...\n');

  try {
    // 1. Unit Test: Deterministic Metric Calculations & Explainability
    console.log('--- 1. Testing Deterministic Metrics & Risk Explainability ---');

    const mockEvents = [
      { timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), eventType: 'LESSON_STARTED' }
    ];
    const mockQuizAttempts = [
      { createdAt: new Date(), isCorrect: false, topic: 'Async JavaScript' },
      { createdAt: new Date(Date.now() - 3600000), isCorrect: false, topic: 'Async JavaScript' },
      { createdAt: new Date(Date.now() - 7200000), isCorrect: false, topic: 'Async JavaScript' }
    ];
    const mockProgressLogs = [
      { progress: 42, completedLessons: ['l1', 'l2'] }
    ];

    const metrics = calculateLearnerMetrics({
      events: mockEvents,
      quizAttempts: mockQuizAttempts,
      progressLogs: mockProgressLogs,
      skills: [],
      weaknesses: [{ topic: 'Async JavaScript' }]
    });

    console.log('Calculated Metrics Output:', JSON.stringify({
      engagementScore: metrics.engagementScore,
      consistencyScore: metrics.consistencyScore,
      learningMomentum: metrics.learningMomentum,
      riskLevel: metrics.riskLevel,
      riskReasons: metrics.riskReasons,
      recommendedNextAction: metrics.recommendedNextAction
    }, null, 2));

    if (metrics.riskLevel === 'HIGH' || metrics.riskLevel === 'CRITICAL') {
      console.log('✅ Risk level calculation PASSED');
    } else {
      throw new Error(`Expected HIGH or CRITICAL risk, got ${metrics.riskLevel}`);
    }

    if (Array.isArray(metrics.riskReasons) && metrics.riskReasons.length >= 2) {
      console.log('✅ Risk explainability reasons PASSED');
    } else {
      throw new Error('Risk explainability reasons failed');
    }

    // 2. Integration Test: Database Sync & Relational Fetch
    console.log('\n--- 2. Testing Database Profile Sync & Relational Fetch ---');
    const testUser = await prisma.user.findFirst() || {
      id: '00000000-0000-0000-0000-000000000001',
      role: 'student'
    };

    const syncedProfile = await syncLearnerProfile(testUser.id);
    console.log(`Profile synced for User ID: ${testUser.id}, Risk Level: ${syncedProfile.riskLevel}`);

    const fullProfile = await getFullLearnerProfile(testUser.id);
    console.log(`Full Profile retrieved with ${fullProfile.skills.length} skills, ${fullProfile.goals.length} goals, ${fullProfile.insights.length} insights.`);

    if (fullProfile && fullProfile.userId === testUser.id) {
      console.log('✅ Database sync and relational profile fetch PASSED');
    } else {
      throw new Error('Profile sync or fetch failed');
    }

    // 3. Integration Test: Skill Node Upsert
    console.log('\n--- 3. Testing Skill Graph Node Upsert ---');
    const updatedSkill = await upsertSkillNode(testUser.id, {
      name: 'Asynchronous Programming',
      category: 'Software Engineering',
      proficiencyLevel: 'intermediate',
      masteryScore: 78,
      confidenceScore: 82
    });

    console.log(`Upserted Skill: ${updatedSkill.name}, Mastery State: ${updatedSkill.masteryState}`);
    if (updatedSkill && updatedSkill.name === 'Asynchronous Programming') {
      console.log('✅ Skill node upsert PASSED');
    } else {
      throw new Error('Skill node upsert failed');
    }

    console.log('\n🎉 ALL LEARNER INTELLIGENCE PROFILE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runLearnerProfileTestSuite();
