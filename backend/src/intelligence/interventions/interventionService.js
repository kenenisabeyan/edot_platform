/**
 * EDOT Intelligence Domain - Instructor Intervention Workflow Engine
 * 
 * Provides human-in-the-loop intervention tracking, recommended teaching actions,
 * status updates, and post-intervention learning outcome monitoring.
 */

import { prisma } from '../../../lib/prisma.js';
import { resolveInstructorContext, verifyInstructorCourseAccess } from '../context/instructorContextResolver.js';
import { getDifficultConcepts, getStudentsNeedingSupport } from '../instructor/instructorIntelligenceService.js';

/**
 * Generates prioritized recommended instructor actions based on real student signals.
 * 
 * @param {string} instructorId 
 */
export async function getRecommendedInstructorActions(instructorId) {
  const context = await resolveInstructorContext(instructorId);
  const recommendations = [];

  for (const courseId of context.assignedCourseIds) {
    const difficultData = await getDifficultConcepts(instructorId, courseId);
    if (difficultData.difficultConcepts && difficultData.difficultConcepts.length > 0) {
      difficultData.difficultConcepts.forEach(dc => {
        recommendations.push({
          id: `rec-concept-${courseId}-${dc.topic.replace(/\s+/g, '-').toLowerCase()}`,
          instructorId,
          courseId,
          recommendationType: 'REVIEW_DIFFICULT_LESSON',
          priority: 'HIGH',
          title: `Review Difficult Topic: ${dc.topic}`,
          reason: dc.evidenceSignal,
          evidence: { affectedStudentsCount: dc.affectedStudentsCount, averageScore: dc.averageScore },
          targetContext: { courseId, topic: dc.topic },
          actionButtons: [
            { type: 'ANNOUNCEMENT_SENT', label: 'Send Announcement' },
            { type: 'ADDITIONAL_PRACTICE_ASSIGNED', label: 'Assign Practice' }
          ],
          dataStatus: 'SUFFICIENT'
        });
      });
    }
  }

  // Check struggling students
  const strugglingStudents = await getStudentsNeedingSupport(instructorId, { limit: 10 });
  if (strugglingStudents.length > 0) {
    strugglingStudents.slice(0, 3).forEach(st => {
      recommendations.push({
        id: `rec-student-${st.courseId}-${st.studentId}`,
        instructorId,
        courseId: st.courseId,
        studentId: st.studentId,
        recommendationType: 'STUDENT_CHECK_IN',
        priority: st.learningStatus === 'SUPPORT_RECOMMENDED' ? 'HIGH' : 'MEDIUM',
        title: `Check in with ${st.studentName}`,
        reason: st.reason,
        evidence: { daysInactive: st.daysInactive, status: st.learningStatus },
        targetContext: { courseId: st.courseId, studentId: st.studentId, studentName: st.studentName },
        actionButtons: [
          { type: 'ENCOURAGEMENT_SENT', label: 'Send Encouragement' },
          { type: 'PROGRESS_REVIEWED', label: 'Review Progress' }
        ],
        dataStatus: 'SUFFICIENT'
      });
    });
  }

  return recommendations;
}

/**
 * Creates a human instructor intervention record.
 * 
 * @param {string} instructorId 
 * @param {object} interventionData 
 * @param {string} interventionData.courseId 
 * @param {string} [interventionData.studentId] 
 * @param {string} [interventionData.lessonId] 
 * @param {string} interventionData.type 
 * @param {string} interventionData.reason 
 * @param {object} [interventionData.evidence] 
 */
export async function createIntervention(instructorId, interventionData) {
  const { courseId, studentId, lessonId, type, reason, evidence } = interventionData;
  await verifyInstructorCourseAccess(instructorId, courseId);

  return await prisma.instructorIntervention.create({
    data: {
      instructorId,
      courseId,
      studentId: studentId || null,
      lessonId: lessonId || null,
      type: type || 'PROGRESS_REVIEWED',
      reason: reason || 'Instructor initiated learning support intervention',
      evidence: evidence || {},
      status: 'STARTED',
      outcome: 'INSUFFICIENT_TIME'
    }
  });
}

/**
 * Updates status and monitors outcome of an intervention.
 * 
 * @param {string} instructorId 
 * @param {string} interventionId 
 * @param {object} params 
 * @param {string} params.status 
 * @param {string} [params.outcomeNotes] 
 */
export async function updateInterventionStatus(instructorId, interventionId, { status, outcomeNotes = '' }) {
  const intervention = await prisma.instructorIntervention.findUnique({
    where: { id: interventionId }
  });

  if (!intervention || intervention.instructorId !== instructorId) {
    throw new Error('Intervention record not found or access unauthorized.');
  }

  const updateData = { status };
  if (status === 'COMPLETED') {
    updateData.completedAt = new Date();

    // Outcome monitoring: Check if student has performed learning activity since intervention creation
    if (intervention.studentId) {
      const subsequentEvents = await prisma.learningEvent.findMany({
        where: {
          userId: intervention.studentId,
          courseId: intervention.courseId,
          timestamp: { gte: intervention.createdAt }
        }
      });

      if (subsequentEvents.length > 0) {
        updateData.outcome = 'ACTIVITY_RESUMED';
      } else {
        updateData.outcome = 'NO_SIGNIFICANT_CHANGE';
      }
    }
  }

  if (outcomeNotes) {
    updateData.outcomeNotes = outcomeNotes;
  }

  return await prisma.instructorIntervention.update({
    where: { id: interventionId },
    data: updateData
  });
}

/**
 * Retrieves intervention history log for an instructor.
 * 
 * @param {string} instructorId 
 * @param {object} [options] 
 * @param {string} [options.courseId] 
 * @param {number} [options.limit=20] 
 */
export async function getInterventionHistory(instructorId, { courseId = null, limit = 20 } = {}) {
  const context = await resolveInstructorContext(instructorId);

  let targetCourseIds = context.assignedCourseIds;
  if (courseId) {
    await verifyInstructorCourseAccess(instructorId, courseId);
    targetCourseIds = [String(courseId)];
  }

  if (targetCourseIds.length === 0) return [];

  return await prisma.instructorIntervention.findMany({
    where: {
      instructorId,
      courseId: { in: targetCourseIds }
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(limit) || 20, 50),
    include: {
      course: { select: { title: true } }
    }
  });
}
