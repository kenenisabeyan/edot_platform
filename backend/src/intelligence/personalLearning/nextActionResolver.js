/**
 * EDOT Intelligence Domain - Next Action Resolver (Phase 10)
 * 
 * Deterministic, evidence-based decision priorities:
 * 1. Fatigue / Safety Signals (TAKE_BREAK)
 * 2. Prerequisite Gaps Blocking Progress (REVIEW_PREREQUISITE)
 * 3. Weak / Decaying Concepts (PRACTICE_CONCEPT | REVIEW_CONCEPT)
 * 4. Normal Curricular Progression (CONTINUE_CURRENT_LESSON)
 * 5. Complete Mastery Advancement (ADVANCE_TO_NEXT_LESSON)
 */

export async function resolveCandidateActions(context) {
  const actions = [];
  const { studentId, activeCourseId, course, completedLessonIds, pulse, prerequisiteGaps, weakConcepts, masteries, dismissedActions } = context;

  if (!activeCourseId || !course) {
    return [{
      actionType: 'NO_ACTION',
      priorityScore: 0.1,
      reason: 'No active course enrollment found.',
      targetNodeId: null,
      targetLessonId: null
    }];
  }

  const dismissedSet = new Set(dismissedActions.map(d => `${d.actionType}_${d.targetNodeId || ''}_${d.targetLessonId || ''}`));

  // 1. Fatigue & Safety Signals -> TAKE_BREAK (Priority: 0.98)
  if (pulse.isFatigued) {
    const key = `TAKE_BREAK__`;
    if (!dismissedSet.has(key)) {
      actions.push({
        actionType: 'TAKE_BREAK',
        priorityScore: 0.98,
        reason: 'Meaningful learning fatigue signals detected. Recommend taking a supportive break before continuing.',
        targetNodeId: null,
        targetLessonId: null
      });
    }
  }

  // 2. Prerequisite Gaps -> REVIEW_PREREQUISITE (Priority: 0.92)
  if (prerequisiteGaps && prerequisiteGaps.length > 0) {
    const topGap = prerequisiteGaps[0];
    if (topGap.gaps && topGap.gaps.length > 0) {
      const gNode = topGap.gaps[0];
      const key = `REVIEW_PREREQUISITE_${gNode.prerequisiteNodeId}_`;
      if (!dismissedSet.has(key)) {
        actions.push({
          actionType: 'REVIEW_PREREQUISITE',
          priorityScore: 0.92,
          reason: `Performance on "${topGap.targetNodeName}" is constrained by prerequisite concept "${gNode.prerequisiteName}".`,
          targetNodeId: gNode.prerequisiteNodeId,
          targetLessonId: null
        });
      }
    }
  }

  // 3. Weak Concepts / Retention Decay -> PRACTICE_CONCEPT or REVIEW_CONCEPT (Priority: 0.85)
  if (weakConcepts && weakConcepts.length > 0) {
    const topWeak = weakConcepts[0];
    const isDecayed = topWeak.decayFactor < 0.85;
    const actionType = isDecayed ? 'PRACTICE_CONCEPT' : 'REVIEW_CONCEPT';
    const key = `${actionType}_${topWeak.nodeId}_`;
    if (!dismissedSet.has(key)) {
      actions.push({
        actionType,
        priorityScore: 0.85,
        reason: isDecayed
          ? `Retention for "${topWeak.node?.name || 'Concept'}" has decayed over time. Targeted practice recommended.`
          : `Evidence shows developing comprehension for "${topWeak.node?.name || 'Concept'}".`,
        targetNodeId: topWeak.nodeId,
        targetLessonId: null
      });
    }
  }

  // 4. Normal Curricular Progression -> CONTINUE_CURRENT_LESSON (Priority: 0.75)
  let nextUncompletedLesson = null;
  if (course.lessons) {
    for (const les of course.lessons) {
      if (!completedLessonIds.has(les.id)) {
        nextUncompletedLesson = les;
        break;
      }
    }
  }

  if (nextUncompletedLesson) {
    actions.push({
      actionType: 'CONTINUE_CURRENT_LESSON',
      priorityScore: 0.75,
      reason: `Learner is making steady progress. Next lesson is "${nextUncompletedLesson.title}".`,
      targetNodeId: null,
      targetLessonId: nextUncompletedLesson.id
    });
  } else if (masteries.length > 0 && masteries.every(m => m.masteryState === 'MASTERED' || m.masteryState === 'PROFICIENT')) {
    // 5. Complete Course Mastery -> ADVANCE_TO_NEXT_LESSON (Priority: 0.80)
    actions.push({
      actionType: 'ADVANCE_TO_NEXT_LESSON',
      priorityScore: 0.80,
      reason: 'Course curriculum and concept masteries are complete. Recommend advancing to next course modules.',
      targetNodeId: null,
      targetLessonId: null
    });
  }

  if (actions.length === 0) {
    actions.push({
      actionType: 'NO_ACTION',
      priorityScore: 0.1,
      reason: 'No immediate action required.',
      targetNodeId: null,
      targetLessonId: null
    });
  }

  return actions;
}
