/**
 * EDOT Context Memory Service
 * contextMemoryService.js
 *
 * Manages conversational memory:
 * 1. Short-Term Memory: Active conversation topic, agreed next steps, recent user feedback during chat session.
 * 2. Durable Long-Term Memory: Extracts and persists durable preferences (e.g. "I want to become a frontend engineer", "I prefer practical examples") to LearnerProfile without storing sensitive or transient conversational content.
 */

import { prisma } from '../../../lib/prisma.js';

/**
 * Extracts and persists durable learner preferences from conversational input.
 *
 * @param {string} userId
 * @param {string} text
 */
export async function updateDurableLearnerMemory(userId, text = '') {
  if (!userId || !text) return;

  const lower = text.toLowerCase();
  const updateData = {};

  // Extract learning style preference
  if (lower.includes('practical example') || lower.includes('hands-on')) {
    updateData.preferredLearningStyle = 'practical';
  } else if (lower.includes('visual') || lower.includes('diagram') || lower.includes('picture')) {
    updateData.preferredLearningStyle = 'visual';
  } else if (lower.includes('deep explanation') || lower.includes('step by step') || lower.includes('in detail')) {
    updateData.preferredLearningStyle = 'detailed';
  }

  // Extract explicit long-term goals
  const goalMatch = text.match(/my goal is (to [^.]+)/i) || text.match(/i want to become (an? [^.]+)/i) || text.match(/i am preparing for ([^.]+)/i);
  if (goalMatch && goalMatch[1]) {
    const goalText = goalMatch[1].trim();
    updateData.currentFocus = goalText;
  }

  if (Object.keys(updateData).length > 0) {
    try {
      await prisma.learnerProfile.upsert({
        where: { userId },
        update: { ...updateData, lastUpdatedAt: new Date() },
        create: {
          userId,
          ...updateData,
          academicLevel: 'Intermediate'
        }
      });
    } catch (err) {
      console.warn('updateDurableLearnerMemory warning:', err.message);
    }
  }
}

/**
 * Records explicit conversation feedback (e.g. "explanation was too difficult", "already know this", "give me an example").
 *
 * @param {string} userId
 * @param {string} feedbackType
 * @param {string} [details]
 */
export async function recordConversationFeedback(userId, feedbackType, details = '') {
  if (!userId || !feedbackType) return;

  try {
    // Record feedback event for closed-loop engine
    await prisma.aIMentorFeedback.create({
      data: {
        userId,
        feedbackType,
        details: details || null,
        createdAt: new Date()
      }
    }).catch(() => {});

    // Immediately adjust user preferences based on feedback
    if (feedbackType === 'TOO_DIFFICULT') {
      await prisma.learnerProfile.update({
        where: { userId },
        data: { preferredLearningStyle: 'guided_step_by_step' }
      }).catch(() => {});
    } else if (feedbackType === 'ALREADY_KNOW_THIS') {
      await prisma.learnerProfile.update({
        where: { userId },
        data: { academicLevel: 'Advanced' }
      }).catch(() => {});
    } else if (feedbackType === 'NEED_PRACTICE') {
      await prisma.learnerProfile.update({
        where: { userId },
        data: { preferredLearningStyle: 'practical' }
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('recordConversationFeedback warning:', err.message);
  }
}
