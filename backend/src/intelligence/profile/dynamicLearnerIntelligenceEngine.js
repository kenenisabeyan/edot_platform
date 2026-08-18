/**
 * EDOT Intelligence Domain - Dynamic Learner Intelligence Engine
 * 
 * Automatically manages student lifecycle intelligence across past, present, and future students and courses:
 * 1. STUDENT_CREATED: Initializes baseline LearnerProfile, empty goals/interests/preferences (no invented data).
 * 2. ENROLLMENT_CREATED: Creates LearnerCourseContext connecting Learner, Course, Category, Skills, Objectives.
 * 3. INCREMENTAL LEARNING EVENTS: Targeted updates on LESSON_STARTED, LESSON_COMPLETED, VIDEO_PROGRESS, 
 *    QUIZ_COMPLETED, QUIZ_PASSED, QUIZ_FAILED, ASSIGNMENT_SUBMITTED, ASSESSMENT_COMPLETED, PROJECT_SUBMITTED.
 * 4. MULTI-LEVEL HIERARCHY: Decoupled isolation supporting Learner -> Global -> Category -> Course -> Section -> Lesson.
 * 5. SELF-HEALING / ZERO MANUAL DB CONFIGURATION: Automatically works for any existing or new student/course.
 */

import { prisma } from '../../../lib/prisma.js';
import { extractConceptsDynamically } from '../dynamic/dynamicContentIntelligenceEngine.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. STUDENT_CREATED Lifecycle Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initializes baseline learner intelligence profile upon student account registration or first access.
 * Uses empty/unknown states where information is missing (never invents data).
 * 
 * @param {string} userId 
 * @param {object} [options]
 */
export async function onStudentCreated(userId, options = {}) {
  const { name, email, department, specialization, academicLevel } = options;

  try {
    // 1. Fetch user to verify existence
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true }
    });

    if (!user) {
      throw new Error(`User [${userId}] not found for dynamic learner intelligence initialization.`);
    }

    // 2. Initialize LearnerProfile with strict empty/unknown defaults (never invent info)
    const profile = await prisma.learnerProfile.upsert({
      where: { userId },
      update: {
        lastUpdatedAt: new Date()
      },
      create: {
        userId,
        academicLevel: academicLevel || department || 'unknown',
        learningGoals: [],
        interests: specialization ? [specialization] : [],
        strengths: [],
        weaknesses: [],
        studyHabits: {
          consistencyScore: 0,
          weeklyStudyHours: 0,
          preferredTime: 'unknown',
          studyPace: 'unknown',
          learningModality: 'unknown'
        },
        learningBehavior: {
          activeCourses: 0,
          completedCourses: 0,
          completedLessons: 0
        },
        completedCourses: 0,
        completedLessons: 0,
        totalSkills: 0,
        quizAverage: 0,
        studyConsistencyScore: 0,
        weeklyStudyHours: 0,
        engagementScore: 0,
        consistencyScore: 0,
        learningMomentum: 50, // Neutral baseline for new learner
        riskLevel: 'LOW',
        riskReasons: [],
        momentumReasons: ['Newly initialized learner profile'],
        recommendedNextAction: 'Explore available courses and enroll in your first module',
        recommendationRationale: {
          basis: 'INITIAL_ONBOARDING',
          detail: 'No active course enrollments yet. Discover foundational courses aligned with your interests.'
        },
        summary: `Learner Profile for ${user.name || 'Student'} initialized. Ready for course enrollment.`
      }
    });

    // 3. Ensure baseline UserSetting preferences exist
    await prisma.userSetting.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        emailNotifications: true,
        pushNotifications: true,
        theme: 'light',
        language: 'en',
        soundEffects: true
      }
    }).catch(() => {});

    return {
      success: true,
      userId,
      profileId: profile.id,
      status: 'LEARNER_INTELLIGENCE_INITIALIZED',
      profileSummary: {
        academicLevel: profile.academicLevel,
        goals: profile.learningGoals,
        interests: profile.interests,
        momentum: profile.learningMomentum
      }
    };
  } catch (error) {
    console.error(`[LearnerIntelligence] Error initializing student [${userId}]:`, error.message);
    return { success: false, userId, error: error.message };
  }
}

/**
 * Self-healing helper: Ensures that a LearnerProfile exists for the given user,
 * creating it lazily if not present (supports all existing students automatically).
 * 
 * @param {string} userId 
 * @returns {Promise<string>} profileId
 */
export async function ensureLearnerInitialized(userId) {
  let profile = await prisma.learnerProfile.findUnique({
    where: { userId }
  });

  if (!profile) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const initResult = await onStudentCreated(userId, { name: user?.name, email: user?.email });
    if (initResult.profileId) {
      return initResult.profileId;
    }
    // Fallback direct create if race condition
    profile = await prisma.learnerProfile.findUnique({ where: { userId } });
  }

  return profile?.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ENROLLMENT_CREATED Lifecycle Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Connects Learner, Course, Category, Skills, and Learning Objectives on enrollment.
 * Works seamlessly for existing students, new students, existing courses, and future courses.
 * 
 * @param {string} userId 
 * @param {string} courseId 
 */
export async function onEnrollmentCreated(userId, courseId) {
  try {
    // 1. Ensure Learner is initialized
    const profileId = await ensureLearnerInitialized(userId);

    // 2. Fetch Course details, syllabus, and objectives
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        sections: { select: { id: true, name: true } },
        lessons: { select: { id: true, title: true, duration: true } }
      }
    });

    if (!course) {
      throw new Error(`Course [${courseId}] not found during enrollment intelligence initialization.`);
    }

    // 3. Upsert UserCourseProgress (LearnerCourseContext)
    const progress = await prisma.userCourseProgress.upsert({
      where: {
        userId_courseId: { userId, courseId }
      },
      update: {
        status: 'active'
      },
      create: {
        userId,
        courseId,
        status: 'active',
        progress: 0,
        completedLessons: [],
        watchedVideos: [],
        passedQuizzes: [],
        score: 0,
        completed: false
      }
    });

    // 4. Extract and connect course skills to learner profile dynamically
    const combinedContent = `${course.title} ${course.description || ''} ${(course.whatYouWillLearn || []).join(' ')} ${(course.tags || []).join(' ')}`;
    const extractedSkills = extractConceptsDynamically(combinedContent);

    // Connect skills in parallel for speed
    await Promise.all(
      extractedSkills.map(async (skillName) => {
        try {
          await prisma.learnerSkill.upsert({
            where: {
              profileId_name: {
                profileId,
                name: skillName
              }
            },
            update: {
              updatedAt: new Date()
            },
            create: {
              userId,
              profileId,
              name: skillName,
              category: course.mainCategory || 'General',
              proficiencyLevel: 'beginner',
              masteryScore: 10,
              confidenceScore: 0.5,
              masteryState: 'learning',
              evidenceCount: 0
            }
          });
        } catch (e) {
          // Ignore individual duplicate skill race conditions
        }
      })
    );

    // 5. Update Global Learner Profile Active Course Context & Next Best Action
    const activeCourseCount = await prisma.userCourseProgress.count({
      where: { userId, status: { in: ['active', 'pending'] } }
    });

    const firstLessonTitle = course.lessons?.[0]?.title || 'Lesson 1';

    await prisma.learnerProfile.updateMany({
      where: { userId },
      data: {
        currentFocus: course.title,
        recommendedNextAction: `Start "${firstLessonTitle}" in ${course.title}`,
        recommendationRationale: {
          basis: 'NEW_ENROLLMENT',
          courseTitle: course.title,
          category: course.mainCategory || 'General',
          detail: `You have successfully enrolled in "${course.title}". Begin with the foundational module to establish momentum.`
        },
        learningBehavior: {
          activeCourses: activeCourseCount,
          currentCourseFocus: course.title
        },
        lastUpdatedAt: new Date()
      }
    });

    return {
      success: true,
      userId,
      courseId,
      courseTitle: course.title,
      category: course.mainCategory || 'General',
      connectedSkills: extractedSkills,
      learningObjectives: course.whatYouWillLearn || [],
      progressContext: {
        progressPercent: progress.progress || 0,
        status: progress.status
      },
      status: 'LEARNER_COURSE_CONTEXT_INITIALIZED'
    };
  } catch (error) {
    console.error(`[LearnerIntelligence] Error connecting enrollment [${userId} -> ${courseId}]:`, error.message);
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Incremental Event-Driven Learning Activity Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles targeted incremental updates when a student learns.
 * Supported events:
 * - LESSON_STARTED
 * - LESSON_COMPLETED
 * - VIDEO_PROGRESS
 * - QUIZ_COMPLETED
 * - QUIZ_PASSED
 * - QUIZ_FAILED
 * - ASSIGNMENT_SUBMITTED
 * - ASSESSMENT_COMPLETED
 * - PROJECT_SUBMITTED
 * 
 * @param {object} eventPayload 
 */
export async function onLearningActivityOccurred(eventPayload) {
  const {
    userId,
    eventType,
    courseId,
    sectionId,
    lessonId,
    quizId,
    assignmentId,
    score,
    duration,
    progress,
    metadata = {}
  } = eventPayload;

  if (!userId) return { success: false, error: 'userId is required' };

  try {
    const profileId = await ensureLearnerInitialized(userId);

    // ─────────────────────────────────────────────────────────────────────────
    // 3a. LESSON_STARTED
    // ─────────────────────────────────────────────────────────────────────────
    if (eventType === 'LESSON_STARTED' && courseId && lessonId) {
      await prisma.learnerProfile.updateMany({
        where: { userId },
        data: {
          learningMomentum: { increment: 1 },
          lastUpdatedAt: new Date()
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3b. LESSON_COMPLETED
    // ─────────────────────────────────────────────────────────────────────────
    if (eventType === 'LESSON_COMPLETED' && courseId && lessonId) {
      const progressRecord = await prisma.userCourseProgress.findUnique({
        where: { userId_courseId: { userId, courseId } }
      });

      let currentCompleted = [];
      if (progressRecord?.completedLessons) {
        if (Array.isArray(progressRecord.completedLessons)) {
          currentCompleted = progressRecord.completedLessons;
        } else if (typeof progressRecord.completedLessons === 'string') {
          try { currentCompleted = JSON.parse(progressRecord.completedLessons); } catch { /* ignore */ }
        }
      }

      if (!currentCompleted.includes(lessonId)) {
        const updatedCompleted = [...currentCompleted, lessonId];
        const totalLessons = await prisma.lesson.count({ where: { courseId } });
        const progressPercent = totalLessons > 0 ? Math.min(100, Math.round((updatedCompleted.length / totalLessons) * 100)) : 100;
        const isCourseComplete = progressPercent >= 100;

        await prisma.userCourseProgress.upsert({
          where: { userId_courseId: { userId, courseId } },
          update: {
            completedLessons: updatedCompleted,
            progress: progressPercent,
            completed: isCourseComplete,
            status: isCourseComplete ? 'completed' : 'active'
          },
          create: {
            userId,
            courseId,
            completedLessons: updatedCompleted,
            progress: progressPercent,
            completed: isCourseComplete,
            status: isCourseComplete ? 'completed' : 'active'
          }
        });
      }

      // Upsert ProgressLog cleanly
      await prisma.progressLog.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        update: {
          isVideoComplete: true,
          updatedAt: new Date()
        },
        create: {
          userId,
          courseId,
          lessonId,
          videoSegments: [0],
          isVideoComplete: true
        }
      });

      // Targeted momentum & next action update
      await prisma.learnerProfile.updateMany({
        where: { userId },
        data: {
          completedLessons: { increment: 1 },
          learningMomentum: { increment: 3 },
          recommendedNextAction: 'Continue with next module lesson or challenge quiz',
          lastUpdatedAt: new Date()
        }
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3c. VIDEO_PROGRESS
    // ─────────────────────────────────────────────────────────────────────────
    if ((eventType === 'VIDEO_PROGRESS' || eventType === 'VIDEO_COMPLETED') && courseId && lessonId) {
      const watchedDuration = duration || metadata.totalSecondsWatched || 30;
      const isComplete = eventType === 'VIDEO_COMPLETED' || Boolean(metadata.isVideoComplete);

      await prisma.progressLog.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        update: {
          isVideoComplete: isComplete,
          updatedAt: new Date()
        },
        create: {
          userId,
          courseId,
          lessonId,
          videoSegments: [Math.floor(watchedDuration / 30) * 30],
          isVideoComplete: isComplete
        }
      });

      // Targeted study hours increment
      const hoursIncrement = Number((watchedDuration / 3600).toFixed(2));
      if (hoursIncrement > 0) {
        await prisma.learnerProfile.updateMany({
          where: { userId },
          data: {
            weeklyStudyHours: { increment: hoursIncrement },
            lastUpdatedAt: new Date()
          }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3d. QUIZ_COMPLETED / QUIZ_PASSED / QUIZ_FAILED
    // ─────────────────────────────────────────────────────────────────────────
    if (eventType === 'QUIZ_COMPLETED' || eventType === 'QUIZ_PASSED' || eventType === 'QUIZ_FAILED') {
      const isPassed = eventType === 'QUIZ_PASSED' || (typeof score === 'number' ? score >= 70 : Boolean(eventPayload.isCorrect));
      const targetTopic = metadata.topic || metadata.skillName || metadata.question || 'Quiz Assessment';
      const timeSpentSeconds = Number(metadata.timeSpentSeconds || metadata.timeSpent || duration || 60);

      // Record clean QuizAttempt according to schema
      await prisma.quizAttempt.create({
        data: {
          userId,
          courseId: courseId || 'general-course',
          lessonId: lessonId || null,
          quizId: quizId || null,
          questionIndex: Number(metadata.questionIndex || 0),
          question: metadata.question || targetTopic,
          selectedAnswer: metadata.selectedAnswer || (isPassed ? 'Correct Option' : 'Attempt Option'),
          correctAnswer: metadata.correctAnswer || 'Correct Option',
          isCorrect: isPassed,
          topic: targetTopic,
          timeSpentSeconds
        }
      });

      // Update targeted Skill Node & Skill Evidence
      const targetSkillName = metadata.skillName || metadata.topic || targetTopic;
      
      const skill = await prisma.learnerSkill.upsert({
        where: { profileId_name: { profileId, name: targetSkillName } },
        update: {
          masteryScore: isPassed ? { increment: 15 } : { increment: 5 },
          evidenceCount: { increment: 1 },
          confidenceScore: isPassed ? 0.85 : 0.45,
          proficiencyLevel: isPassed ? 'intermediate' : 'beginner',
          masteryState: isPassed ? 'practicing' : 'learning',
          lastPracticedAt: new Date()
        },
        create: {
          userId,
          profileId,
          name: targetSkillName,
          category: metadata.category || 'General',
          proficiencyLevel: isPassed ? 'intermediate' : 'beginner',
          masteryScore: isPassed ? 25 : 10,
          confidenceScore: isPassed ? 0.75 : 0.4,
          masteryState: isPassed ? 'practicing' : 'learning',
          evidenceCount: 1,
          lastPracticedAt: new Date()
        }
      });

      // Create verifiable Skill Evidence
      await prisma.skillEvidence.create({
        data: {
          skillId: skill.id,
          userId,
          evidenceType: 'QUIZ_ATTEMPT',
          title: `Quiz Assessment: ${targetTopic}`,
          sourceId: quizId || lessonId || 'quiz-evidence',
          score: typeof score === 'number' ? score : (isPassed ? 100 : 50),
          verificationLevel: 'VERIFIED',
          metadata: {
            isCorrect: isPassed,
            timeSpentSeconds,
            courseId
          }
        }
      });

      // Track weak areas on failure / misconception
      if (!isPassed) {
        await prisma.learnerWeakness.upsert({
          where: { profileId_topic: { profileId, topic: targetSkillName } },
          update: {
            category: 'Quiz Misconception',
            severity: 'medium',
            impactScore: { increment: 10 },
            lastObservedAt: new Date(),
            improvementPlan: `Review lecture notes and practice core principles of ${targetSkillName}`
          },
          create: {
            userId,
            profileId,
            topic: targetSkillName,
            category: 'Quiz Misconception',
            severity: 'medium',
            impactScore: 50,
            improvementPlan: `Review lecture notes and practice core principles of ${targetSkillName}`,
            lastObservedAt: new Date()
          }
        });

        // Update Next Best Action to targeted review
        await prisma.learnerProfile.updateMany({
          where: { userId },
          data: {
            recommendedNextAction: `Review key concepts in ${targetSkillName}`,
            recommendationRationale: {
              basis: 'QUIZ_REMEDIATION',
              topic: targetSkillName,
              detail: `Recent quiz attempt identified an opportunity to reinforce ${targetSkillName}. Reviewing related lecture material is recommended.`
            },
            lastUpdatedAt: new Date()
          }
        });
      } else {
        // If passed with strong score, refresh next best action
        await prisma.learnerProfile.updateMany({
          where: { userId },
          data: {
            learningMomentum: { increment: 5 },
            recommendedNextAction: 'Proceed to next advanced lecture or challenge project',
            recommendationRationale: {
              basis: 'MASTERY_PROGRESSION',
              topic: targetSkillName,
              detail: `Demonstrated strong comprehension in ${targetSkillName}. Keep advancing to higher modules.`
            },
            lastUpdatedAt: new Date()
          }
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3e. ASSIGNMENT_SUBMITTED / ASSESSMENT_COMPLETED / PROJECT_SUBMITTED
    // ─────────────────────────────────────────────────────────────────────────
    if (eventType === 'ASSIGNMENT_SUBMITTED' || eventType === 'ASSESSMENT_COMPLETED' || eventType === 'PROJECT_SUBMITTED') {
      const topic = metadata.topic || metadata.skillName || metadata.projectTitle || 'Practical Project';
      
      const skill = await prisma.learnerSkill.upsert({
        where: { profileId_name: { profileId, name: topic } },
        update: {
          masteryScore: { increment: 20 },
          evidenceCount: { increment: 1 },
          confidenceScore: 0.9,
          proficiencyLevel: 'advanced',
          masteryState: 'mastered',
          lastPracticedAt: new Date()
        },
        create: {
          userId,
          profileId,
          name: topic,
          category: metadata.category || 'Practical Project',
          proficiencyLevel: 'intermediate',
          masteryScore: 30,
          confidenceScore: 0.8,
          masteryState: 'practicing',
          evidenceCount: 1,
          lastPracticedAt: new Date()
        }
      });

      await prisma.skillEvidence.create({
        data: {
          skillId: skill.id,
          userId,
          evidenceType: eventType,
          title: metadata.title || `${eventType}: ${topic}`,
          sourceId: assignmentId || metadata.projectId || 'project-evidence',
          score: typeof score === 'number' ? score : 90,
          verificationLevel: 'VERIFIED',
          metadata: {
            courseId,
            submittedAt: new Date().toISOString()
          }
        }
      });

      await prisma.learnerProfile.updateMany({
        where: { userId },
        data: {
          learningMomentum: { increment: 8 },
          lastUpdatedAt: new Date()
        }
      });
    }

    return {
      success: true,
      userId,
      eventType,
      status: 'INCREMENTAL_LEARNING_INTELLIGENCE_UPDATED'
    };
  } catch (error) {
    console.error(`[LearnerIntelligence] Error processing event [${eventType}] for student [${userId}]:`, error.message);
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Multi-Level Hierarchy Context Query (Decoupled Isolation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns structured hierarchy distinguishing Global Profile from Course/Category/Section/Lesson Intelligence.
 * 
 * Hierarchy:
 * Learner -> Global Intelligence -> Category Intelligence -> Course Intelligence -> Section Intelligence -> Lesson Intelligence
 * 
 * @param {string} userId 
 * @param {string} [courseId] 
 * @param {string} [lessonId] 
 * @param {string} [sectionId] 
 */
export async function getMultiLevelLearnerContext(userId, courseId = null, lessonId = null, sectionId = null) {
  // Ensure profile exists lazily
  await ensureLearnerInitialized(userId);

  const [user, profile, allProgress, allSkills, allWeaknesses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true }
    }),
    prisma.learnerProfile.findUnique({
      where: { userId },
      include: {
        skills: true,
        weaknessEntries: true,
        goals: true,
        learnerInterests: true
      }
    }),
    prisma.userCourseProgress.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            mainCategory: true,
            subCategory: true,
            sections: { select: { id: true, name: true } },
            lessons: { select: { id: true, title: true, duration: true } }
          }
        }
      }
    }),
    prisma.learnerSkill.findMany({ where: { userId } }),
    prisma.learnerWeakness.findMany({ where: { userId } })
  ]);

  // 1. Global Level Intelligence
  const globalIntelligence = {
    userId,
    learnerName: user?.name || 'Student',
    email: user?.email || '',
    overallMomentum: profile?.learningMomentum || 50,
    academicLevel: profile?.academicLevel || 'unknown',
    globalGoals: profile?.learningGoals || [],
    interests: profile?.interests || [],
    strengths: profile?.strengths || [],
    weaknesses: profile?.weaknesses || [],
    studyHabits: profile?.studyHabits || {},
    totalActiveCourses: allProgress.filter(p => p.status === 'active').length,
    totalCompletedCourses: allProgress.filter(p => p.completed || p.status === 'completed').length,
    globalMasterySkills: allSkills.map(s => ({
      name: s.name,
      proficiencyLevel: s.proficiencyLevel,
      masteryScore: s.masteryScore,
      masteryState: s.masteryState
    })),
    recommendedNextAction: profile?.recommendedNextAction || 'Continue your learning journey',
    recommendationRationale: profile?.recommendationRationale || null
  };

  // 2. Category Level Intelligence (Strict Aggregation without Data Corruption)
  const categoryMap = {};
  allProgress.forEach(p => {
    const cat = p.course?.mainCategory || 'General';
    if (!categoryMap[cat]) {
      categoryMap[cat] = {
        categoryName: cat,
        activeCourses: 0,
        completedCourses: 0,
        totalProgressPercent: 0,
        coursesCount: 0,
        skills: []
      };
    }
    categoryMap[cat].coursesCount++;
    if (p.status === 'active') categoryMap[cat].activeCourses++;
    if (p.completed || p.status === 'completed') categoryMap[cat].completedCourses++;
    categoryMap[cat].totalProgressPercent += (p.progress || 0);
  });

  Object.keys(categoryMap).forEach(cat => {
    const data = categoryMap[cat];
    data.averageProgress = data.coursesCount > 0 ? Math.round(data.totalProgressPercent / data.coursesCount) : 0;
    data.skills = allSkills.filter(s => s.category === cat).map(s => s.name);
  });

  // 3. Course Specific Level (Strictly Decoupled)
  let courseIntelligence = null;
  if (courseId) {
    const targetProgress = allProgress.find(p => p.courseId === courseId);
    const courseDoc = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        sections: { orderBy: { createdAt: 'asc' } },
        lessons: { orderBy: { order: 'asc' }, include: { quizzes: true } }
      }
    });

    const completedLessonIds = Array.isArray(targetProgress?.completedLessons) 
      ? targetProgress.completedLessons 
      : (typeof targetProgress?.completedLessons === 'string' ? JSON.parse(targetProgress.completedLessons || '[]') : []);

    const courseSkills = allSkills.filter(s => s.category === courseDoc?.mainCategory);
    const courseWeaknesses = allWeaknesses.filter(w => w.category?.includes('Quiz') || w.improvementPlan?.includes(courseDoc?.title || ''));

    courseIntelligence = {
      courseId,
      courseTitle: courseDoc?.title || 'Course',
      category: courseDoc?.mainCategory || 'General',
      subCategory: courseDoc?.subCategory || 'General',
      status: targetProgress?.status || 'not_enrolled',
      progressPercent: targetProgress?.progress || 0,
      completedLessonsCount: completedLessonIds.length,
      totalLessonsCount: courseDoc?.lessons?.length || 0,
      sectionsCount: courseDoc?.sections?.length || 0,
      completedLessonIds,
      courseSpecificSkills: courseSkills.map(s => ({ name: s.name, masteryScore: s.masteryScore, level: s.proficiencyLevel })),
      courseSpecificWeaknesses: courseWeaknesses.map(w => ({ topic: w.topic, severity: w.severity, plan: w.improvementPlan })),
      nextRecommendedLesson: courseDoc?.lessons?.find(l => !completedLessonIds.includes(l.id))?.title || 'All lessons completed'
    };
  }

  // 4. Section Specific Level
  let sectionIntelligence = null;
  if (sectionId && courseId) {
    const sectionDoc = await prisma.section.findUnique({
      where: { id: sectionId }
    });

    sectionIntelligence = {
      sectionId,
      sectionName: sectionDoc?.name || 'Section',
      sectionCode: sectionDoc?.sectionCode || '',
      status: sectionDoc?.status || 'active'
    };
  }

  // 5. Lesson Specific Level
  let lessonIntelligence = null;
  if (lessonId) {
    const lessonDoc = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { quizzes: true, materials: true }
    });

    const progressLog = await prisma.progressLog.findUnique({
      where: { userId_lessonId: { userId, lessonId } }
    });

    lessonIntelligence = {
      lessonId,
      lessonTitle: lessonDoc?.title || 'Lesson',
      durationMinutes: lessonDoc?.duration || 10,
      isVideoComplete: progressLog?.isVideoComplete || false,
      quizzesCount: lessonDoc?.quizzes?.length || 0,
      materialsCount: lessonDoc?.materials?.length || 0
    };
  }

  return {
    learner: { id: userId, name: user?.name, email: user?.email },
    globalIntelligence,
    categoryIntelligence: categoryMap,
    courseIntelligence,
    sectionIntelligence,
    lessonIntelligence
  };
}
