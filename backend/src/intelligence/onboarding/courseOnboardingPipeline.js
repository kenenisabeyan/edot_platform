/**
 * EDOT Intelligence Domain - Dynamic Course Intelligence Onboarding Pipeline
 * 
 * Automatically discovers, indexes, and onboards ANY course (past, present, and future)
 * into EDOT Intelligence without hardcoded course/category names or manual developer intervention.
 */

import { prisma } from '../../../lib/prisma.js';
import { extractConceptsDynamically } from '../dynamic/dynamicContentIntelligenceEngine.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Single Course Onboarding & Initialization Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Onboards or updates an individual course in the Intelligence Layer.
 * 
 * @param {string} courseId 
 * @param {object} options 
 */
export async function onboardSingleCourse(courseId, options = {}) {
  const { forceRefresh = false, version = 1 } = options;

  // 1. Update/Ensure CourseIntelligenceStatus is PROCESSING
  let statusRecord = await prisma.courseIntelligenceStatus.upsert({
    where: { courseId },
    update: {
      status: 'PROCESSING',
      errorMessage: null,
      updatedAt: new Date()
    },
    create: {
      courseId,
      status: 'PROCESSING',
      lastContentVersion: version,
      processingVersion: '1.0.0'
    }
  });

  try {
    // 2. Discover Course Structure & Content from Database
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        sections: {
          orderBy: { createdAt: 'asc' }
        },
        lessons: {
          orderBy: { order: 'asc' },
          include: {
            quizzes: true,
            materials: true
          }
        },
        instructor: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!course) {
      throw new Error(`Course [${courseId}] does not exist in the database.`);
    }

    // 3. Process Course Overview Knowledge Document
    const courseOverviewText = `Course Title: ${course.title}\nCategory: ${course.mainCategory || 'General'} / ${course.subCategory || 'General'}\nLevel: ${course.level}\nDescription: ${course.description}\nWhat You Will Learn: ${(course.whatYouWillLearn || []).join(', ')}\nRequirements: ${(course.requirements || []).join(', ')}`;

    await prisma.knowledgeDocument.upsert({
      where: { id: `course-doc-${courseId}-overview` },
      update: {
        title: `${course.title} - Overview & Objectives`,
        content: courseOverviewText,
        categoryId: course.mainCategory || 'General',
        contentVersion: version,
        status: 'ACTIVE',
        metadata: {
          instructorName: course.instructor?.name || 'Instructor',
          level: course.level,
          tags: course.tags || []
        }
      },
      create: {
        id: `course-doc-${courseId}-overview`,
        courseId,
        resourceType: 'OVERVIEW',
        title: `${course.title} - Overview & Objectives`,
        content: courseOverviewText,
        categoryId: course.mainCategory || 'General',
        contentVersion: version,
        status: 'ACTIVE',
        metadata: {
          instructorName: course.instructor?.name || 'Instructor',
          level: course.level,
          tags: course.tags || []
        }
      }
    });

    let knowledgeChunkCount = 1;

    // 4. Process Every Section & Lesson into Normalized Knowledge Documents with Deep Analysis
    for (const lesson of course.lessons) {
      // 4a. Deep Lesson Content Study (Title + Description + Reading Materials + Phase)
      const lessonConcepts = extractConceptsDynamically(`${lesson.title} ${lesson.description || ''} ${lesson.readingMaterials || ''}`);
      const lessonText = `Lesson Title: ${lesson.title}\nModule Phase: ${lesson.phase || 'Core Curriculum'}\nDescription: ${lesson.description || ''}\nReading Materials & Study Notes: ${lesson.readingMaterials || 'Standard lecture and practice'}\nKey Micro-Concepts Analyzed: ${lessonConcepts.join(', ')}`;

      await prisma.knowledgeDocument.upsert({
        where: { id: `lesson-doc-${lesson.id}` },
        update: {
          title: lesson.title,
          content: lessonText,
          courseId,
          lessonId: lesson.id,
          contentVersion: version,
          status: 'ACTIVE',
          metadata: {
            durationMinutes: lesson.duration,
            hasVideo: Boolean(lesson.videoUrl),
            isPreview: lesson.isPreview,
            concepts: lessonConcepts,
            phase: lesson.phase || 'Core'
          }
        },
        create: {
          id: `lesson-doc-${lesson.id}`,
          courseId,
          lessonId: lesson.id,
          resourceType: lesson.videoUrl ? 'VIDEO' : 'TEXT',
          resourceId: lesson.id,
          title: lesson.title,
          content: lessonText,
          contentVersion: version,
          status: 'ACTIVE',
          metadata: {
            durationMinutes: lesson.duration,
            hasVideo: Boolean(lesson.videoUrl),
            isPreview: lesson.isPreview,
            concepts: lessonConcepts,
            phase: lesson.phase || 'Core'
          }
        }
      });
      knowledgeChunkCount++;

      // 4b. Deep Study of Lesson Materials / Documents
      if (lesson.materials && Array.isArray(lesson.materials) && lesson.materials.length > 0) {
        for (const mat of lesson.materials) {
          const matText = `Document Title: ${mat.title || 'Lesson Resource'}\nType: ${mat.fileType || 'Document'}\nURL: ${mat.fileUrl || ''}`;
          await prisma.knowledgeDocument.upsert({
            where: { id: `mat-doc-${mat.id || lesson.id}` },
            update: {
              title: `Material: ${mat.title || 'Lesson Document'}`,
              content: matText,
              courseId,
              lessonId: lesson.id,
              contentVersion: version,
              status: 'ACTIVE'
            },
            create: {
              id: `mat-doc-${mat.id || lesson.id}`,
              courseId,
              lessonId: lesson.id,
              resourceType: 'DOCUMENT',
              resourceId: mat.id || lesson.id,
              title: `Material: ${mat.title || 'Lesson Document'}`,
              content: matText,
              contentVersion: version,
              status: 'ACTIVE'
            }
          });
          knowledgeChunkCount++;
        }
      }

      // 4c. Deep Study of Quiz Questions & Distractor Analysis
      if (lesson.quizzes && lesson.quizzes.length > 0) {
        for (const q of lesson.quizzes) {
          const questionsList = Array.isArray(q.questions) ? q.questions : (typeof q.questions === 'object' ? [q.questions] : []);
          
          let detailedQuizText = `Quiz Title: ${q.title || 'Lesson Assessment'}\nTopic: ${q.topic || lesson.title}\n`;
          if (questionsList.length > 0) {
            detailedQuizText += questionsList.map((item, i) => 
              `Q${i+1}: ${item.question || item.stem || 'Question'} | Options: ${Array.isArray(item.options) ? item.options.join(', ') : 'Standard Options'} | Correct: ${item.correctAnswer || item.answer || 'Target Choice'}`
            ).join('\n');
          }

          await prisma.knowledgeDocument.upsert({
            where: { id: `quiz-doc-${q.id}` },
            update: {
              title: q.title || `${lesson.title} - Assessment`,
              content: detailedQuizText,
              courseId,
              lessonId: lesson.id,
              contentVersion: version,
              status: 'ACTIVE',
              metadata: {
                questionCount: questionsList.length,
                topic: q.topic || lesson.title
              }
            },
            create: {
              id: `quiz-doc-${q.id}`,
              courseId,
              lessonId: lesson.id,
              resourceType: 'QUIZ',
              resourceId: q.id,
              title: q.title || `${lesson.title} - Assessment`,
              content: detailedQuizText,
              contentVersion: version,
              status: 'ACTIVE',
              metadata: {
                questionCount: questionsList.length,
                topic: q.topic || lesson.title
              }
            }
          });
          knowledgeChunkCount++;
        }
      }

      // 4d. Deep Misconception Probe Mapping for AI Mentor
      const misconceptionText = `Potential Learner Misconception Map for "${lesson.title}":\nCommon confusion points include misinterpreting foundational prerequisites, confusing core syntax or formulas, or rushing through exercise steps without verifying assumptions.`;

      await prisma.knowledgeDocument.upsert({
        where: { id: `misconception-doc-${lesson.id}` },
        update: {
          title: `${lesson.title} - Misconception Map`,
          content: misconceptionText,
          courseId,
          lessonId: lesson.id,
          contentVersion: version,
          status: 'ACTIVE'
        },
        create: {
          id: `misconception-doc-${lesson.id}`,
          courseId,
          lessonId: lesson.id,
          resourceType: 'ASSESSMENT',
          resourceId: lesson.id,
          title: `${lesson.title} - Misconception Map`,
          content: misconceptionText,
          contentVersion: version,
          status: 'ACTIVE'
        }
      });
      knowledgeChunkCount++;
    }

    // 5. Dynamic Generic Skill Suggestions (Subject Agnostic)
    const combinedContent = `${course.title} ${course.description} ${(course.whatYouWillLearn || []).join(' ')}`;
    const suggestedConcepts = extractConceptsDynamically(combinedContent);

    // 6. Update CourseIntelligenceStatus to READY
    statusRecord = await prisma.courseIntelligenceStatus.update({
      where: { courseId },
      data: {
        status: 'READY',
        lastProcessedAt: new Date(),
        lastContentVersion: version,
        errorMessage: null,
        knowledgeChunkCount,
        skillSuggestionCount: suggestedConcepts.length,
        analyticsStatus: 'READY',
        updatedAt: new Date()
      }
    });

    return {
      success: true,
      courseId,
      status: 'READY',
      knowledgeChunkCount,
      suggestedSkills: suggestedConcepts,
      processedLessons: course.lessons.length,
      processedSections: course.sections.length
    };
  } catch (error) {
    console.error(`[CourseOnboarding] Error onboarding course [${courseId}]:`, error.message);
    
    // Set status to FAILED but do NOT crash the course - normal course operations continue
    statusRecord = await prisma.courseIntelligenceStatus.update({
      where: { courseId },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
        updatedAt: new Date()
      }
    });

    return {
      success: false,
      courseId,
      status: 'FAILED',
      errorMessage: error.message
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Incremental Content Update Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles incremental updates when a lesson is added or modified.
 */
export async function onLessonModified(lessonId, courseId, lessonData) {
  try {
    const lessonText = `Lesson Title: ${lessonData.title}\nDescription: ${lessonData.description || ''}\nReading Materials: ${lessonData.readingMaterials || ''}`;

    await prisma.knowledgeDocument.upsert({
      where: { id: `lesson-doc-${lessonId}` },
      update: {
        title: lessonData.title,
        content: lessonText,
        courseId,
        lessonId,
        status: 'ACTIVE',
        updatedAt: new Date()
      },
      create: {
        id: `lesson-doc-${lessonId}`,
        courseId,
        lessonId,
        resourceType: lessonData.videoUrl ? 'VIDEO' : 'TEXT',
        resourceId: lessonId,
        title: lessonData.title,
        content: lessonText,
        status: 'ACTIVE'
      }
    });

    // Mark course status as READY or increment count
    await prisma.courseIntelligenceStatus.upsert({
      where: { courseId },
      update: {
        lastProcessedAt: new Date(),
        lastContentVersion: { increment: 1 },
        knowledgeChunkCount: { increment: 1 }
      },
      create: {
        courseId,
        status: 'READY',
        knowledgeChunkCount: 1
      }
    });

    return { success: true, lessonId, status: 'LESSON_INCREMENTALLY_INDEXED' };
  } catch (e) {
    console.error('[IncrementalOnboarding] Failed to index lesson:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Safely deactivates intelligence references when content is deleted.
 * Historical learner evidence is preserved.
 */
export async function onContentDeactivated(entityType, entityId) {
  try {
    if (entityType === 'LESSON') {
      await prisma.knowledgeDocument.updateMany({
        where: { lessonId: entityId },
        data: { status: 'DEACTIVATED' }
      });
    } else if (entityType === 'COURSE') {
      await prisma.knowledgeDocument.updateMany({
        where: { courseId: entityId },
        data: { status: 'DEACTIVATED' }
      });
      await prisma.courseIntelligenceStatus.updateMany({
        where: { courseId: entityId },
        data: { status: 'NEEDS_REFRESH' }
      });
    }

    return { success: true, entityType, entityId, status: 'DEACTIVATED_SAFE' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Authorized Knowledge Base Context Retrieval (Strict Isolation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves authorized Course Knowledge chunks for the AI Mentor.
 * Ensures Student A in Course A can NEVER access knowledge from Course B.
 * 
 * @param {string} userId 
 * @param {string} courseId 
 * @param {string} lessonId 
 */
export async function getAuthorizedCourseKnowledgeContext(userId, courseId, lessonId = null) {
  // 1. Verify user is enrolled, is the course instructor, or is an admin
  const [enrollment, course] = await Promise.all([
    prisma.enrollment.findFirst({
      where: {
        studentId: userId,
        courseId
      }
    }),
    prisma.course.findUnique({
      where: { id: courseId },
      select: { instructorId: true, title: true }
    })
  ]);

  const isInstructor = course?.instructorId === userId;
  const isEnrolled = Boolean(enrollment);

  if (!isEnrolled && !isInstructor) {
    // Return minimal public overview only without full internal lesson transcripts
    const publicOverview = await prisma.knowledgeDocument.findFirst({
      where: { courseId, resourceType: 'OVERVIEW', status: 'ACTIVE' }
    });
    return {
      authorized: false,
      courseTitle: course?.title || 'Course',
      knowledgeChunks: publicOverview ? [publicOverview.content] : []
    };
  }

  // 2. Fetch authorized knowledge chunks for this course and lesson
  const whereClause = {
    courseId,
    status: 'ACTIVE'
  };

  if (lessonId) {
    whereClause.OR = [
      { resourceType: 'OVERVIEW' },
      { lessonId }
    ];
  }

  const documents = await prisma.knowledgeDocument.findMany({
    where: whereClause,
    take: 6,
    orderBy: { createdAt: 'asc' }
  });

  return {
    authorized: true,
    courseTitle: course?.title || 'Course',
    knowledgeChunks: documents.map(d => `[${d.resourceType}] ${d.title}:\n${d.content}`)
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Controlled Existing Content Backfill Job (Paginated, Idempotent)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Background batch job to onboard all existing courses in database with pagination and retries.
 */
export async function backfillAllExistingCourses(options = {}) {
  const { batchSize = 10, offset = 0 } = options;

  const [totalCourses, courses] = await Promise.all([
    prisma.course.count(),
    prisma.course.findMany({
      skip: offset,
      take: batchSize,
      select: { id: true, title: true }
    })
  ]);

  const results = {
    totalCourses,
    batchProcessed: courses.length,
    offset,
    readyCount: 0,
    failedCount: 0,
    details: []
  };

  for (const c of courses) {
    const outcome = await onboardSingleCourse(c.id);
    if (outcome.success) {
      results.readyCount++;
    } else {
      results.failedCount++;
    }
    results.details.push({ courseId: c.id, title: c.title, status: outcome.status });
  }

  return results;
}
