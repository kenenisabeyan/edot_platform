import express from 'express';
import { protect } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = express.Router();

const buildDerivedProfile = async (userId) => {
  const [progressRecords, progressLogs, enrollments] = await Promise.all([
    prisma.userCourseProgress.findMany({
      where: { userId },
      include: { course: true }
    }),
    prisma.progressLog.findMany({ where: { userId } }),
    prisma.enrollment.findMany({ where: { studentId: userId } })
  ]);

  const completedCourses = progressRecords.filter((entry) => entry.completed).length;
  const completedLessons = progressRecords.reduce((total, entry) => {
    const completedItems = Array.isArray(entry.completedLessons) ? entry.completedLessons : [];
    return total + completedItems.length;
  }, 0) + progressLogs.length;

  const courseScores = progressRecords
    .filter((entry) => typeof entry.score === 'number')
    .map((entry) => entry.score);
  const quizAverage = courseScores.length > 0
    ? courseScores.reduce((sum, value) => sum + value, 0) / courseScores.length
    : 0;

  const categoryPerformance = progressRecords.reduce((acc, entry) => {
    const category = entry.course?.mainCategory || 'General';
    if (!acc[category]) acc[category] = { totalScore: 0, count: 0 };
    acc[category].totalScore += entry.score || 0;
    acc[category].count += 1;
    return acc;
  }, {});

  const strengths = Object.entries(categoryPerformance)
    .sort((a, b) => b[1].totalScore - a[1].totalScore)
    .slice(0, 4)
    .map(([category]) => category);

  const weaknesses = Object.entries(categoryPerformance)
    .sort((a, b) => a[1].totalScore - b[1].totalScore)
    .slice(0, 3)
    .map(([category]) => category);

  const studyConsistencyScore = Math.min(100, Math.round((progressLogs.length * 4) + (completedCourses * 5)));
  const weeklyStudyHours = Math.max(1, Math.round((progressLogs.length + completedLessons) / 6));
  const confidenceScore = Math.min(100, Math.round(quizAverage + (completedCourses * 4)));
  const aiReadinessScore = Math.min(100, Math.round((studyConsistencyScore * 0.6) + (confidenceScore * 0.4)));

  return {
    academicLevel: enrollments.length > 3 ? 'Advanced' : 'Intermediate',
    interests: progressRecords.map((entry) => entry.course?.mainCategory).filter(Boolean),
    learningGoals: ['Build consistent study habits', 'Improve mastery in current courses', 'Track long-term growth'],
    strengths,
    weaknesses,
    studyHabits: {
      consistencyScore: studyConsistencyScore,
      weeklyStudyHours,
      preferredTime: 'Flexible study blocks'
    },
    learningBehavior: {
      activeCourses: progressRecords.length,
      completedCourses,
      completedLessons
    },
    completedCourses,
    completedLessons,
    quizAverage,
    studyConsistencyScore,
    weeklyStudyHours,
    currentFocus: progressRecords[0]?.course?.title || 'Building momentum',
    confidenceScore,
    aiReadinessScore,
    summary: 'This learner profile is derived from course progress, quiz performance, and study consistency for future personalization.'
  };
};

const ensureProfile = async (userId) => {
  let profile = await prisma.learnerProfile.findUnique({ where: { userId } });

  if (!profile) {
    const derived = await buildDerivedProfile(userId);
    profile = await prisma.learnerProfile.create({
      data: {
        userId,
        academicLevel: derived.academicLevel,
        interests: derived.interests,
        learningGoals: derived.learningGoals,
        strengths: derived.strengths,
        weaknesses: derived.weaknesses,
        studyHabits: derived.studyHabits,
        learningBehavior: derived.learningBehavior,
        completedCourses: derived.completedCourses,
        completedLessons: derived.completedLessons,
        quizAverage: derived.quizAverage,
        studyConsistencyScore: derived.studyConsistencyScore,
        weeklyStudyHours: derived.weeklyStudyHours,
        currentFocus: derived.currentFocus,
        confidenceScore: derived.confidenceScore,
        aiReadinessScore: derived.aiReadinessScore,
        summary: derived.summary
      }
    });
  }

  return profile;
};

router.get('/me', protect, async (req, res) => {
  try {
    const profile = await ensureProfile(req.user.id);
    const fullProfile = await prisma.learnerProfile.findUnique({
      where: { id: profile.id },
      include: {
        skills: true,
        weaknessEntries: true,
        historyEvents: { orderBy: { occurredAt: 'desc' }, take: 10 },
        progressSnapshots: { orderBy: { generatedAt: 'desc' }, take: 5 }
      }
    });

    return res.json({ success: true, data: fullProfile });
  } catch (error) {
    console.error('Error fetching learning profile:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch learning profile' });
  }
});

router.post('/sync', protect, async (req, res) => {
  try {
    const { academicLevel, interests, learningGoals, strengths, weaknesses, studyHabits, learningBehavior, completedCourses, completedLessons, quizAverage, studyConsistencyScore, weeklyStudyHours, currentFocus, confidenceScore, aiReadinessScore, summary } = req.body;

    const derived = await buildDerivedProfile(req.user.id);

    let profile = await prisma.learnerProfile.findUnique({ where: { userId: req.user.id } });

    if (!profile) {
      profile = await prisma.learnerProfile.create({
        data: {
          userId: req.user.id,
          academicLevel: academicLevel || derived.academicLevel,
          interests: interests || derived.interests,
          learningGoals: learningGoals || derived.learningGoals,
          strengths: strengths || derived.strengths,
          weaknesses: weaknesses || derived.weaknesses,
          studyHabits: studyHabits || derived.studyHabits,
          learningBehavior: learningBehavior || derived.learningBehavior,
          completedCourses: completedCourses ?? derived.completedCourses,
          completedLessons: completedLessons ?? derived.completedLessons,
          quizAverage: quizAverage ?? derived.quizAverage,
          studyConsistencyScore: studyConsistencyScore ?? derived.studyConsistencyScore,
          weeklyStudyHours: weeklyStudyHours ?? derived.weeklyStudyHours,
          currentFocus: currentFocus || derived.currentFocus,
          confidenceScore: confidenceScore ?? derived.confidenceScore,
          aiReadinessScore: aiReadinessScore ?? derived.aiReadinessScore,
          summary: summary || derived.summary
        }
      });
    } else {
      profile = await prisma.learnerProfile.update({
        where: { userId: req.user.id },
        data: {
          academicLevel: academicLevel || profile.academicLevel,
          interests: interests || profile.interests,
          learningGoals: learningGoals || profile.learningGoals,
          strengths: strengths || profile.strengths,
          weaknesses: weaknesses || profile.weaknesses,
          studyHabits: studyHabits || profile.studyHabits,
          learningBehavior: learningBehavior || profile.learningBehavior,
          completedCourses: completedCourses ?? profile.completedCourses,
          completedLessons: completedLessons ?? profile.completedLessons,
          quizAverage: quizAverage ?? profile.quizAverage,
          studyConsistencyScore: studyConsistencyScore ?? profile.studyConsistencyScore,
          weeklyStudyHours: weeklyStudyHours ?? derived.weeklyStudyHours,
          currentFocus: currentFocus ?? profile.currentFocus,
          confidenceScore: confidenceScore ?? profile.confidenceScore,
          aiReadinessScore: aiReadinessScore ?? profile.aiReadinessScore,
          summary: summary ?? profile.summary
        }
      });
    }

    return res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Error syncing learning profile:', error);
    return res.status(500).json({ success: false, message: 'Failed to sync learning profile' });
  }
});

router.post('/events', protect, async (req, res) => {
  try {
    const { eventType, title, description, courseId, lessonId, score, durationMinutes, metadata } = req.body;

    const profile = await prisma.learnerProfile.findUnique({ where: { userId: req.user.id } });

    const event = await prisma.learningHistoryEvent.create({
      data: {
        userId: req.user.id,
        profileId: profile?.id || null,
        eventType,
        title,
        description,
        courseId,
        lessonId,
        score,
        durationMinutes: durationMinutes || 0,
        metadata: metadata || {}
      }
    });

    return res.json({ success: true, data: event });
  } catch (error) {
    console.error('Error recording learning event:', error);
    return res.status(500).json({ success: false, message: 'Failed to record learning event' });
  }
});

router.post('/skills', protect, async (req, res) => {
  try {
    const { name, category, proficiencyLevel, masteryScore, confidenceScore, evidenceCount } = req.body;

    const profile = await prisma.learnerProfile.findUnique({ where: { userId: req.user.id } });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Learning profile not found' });
    }

    const skill = await prisma.learnerSkill.upsert({
      where: { profileId_name: { profileId: profile.id, name } },
      update: {
        category,
        proficiencyLevel: proficiencyLevel || 'beginner',
        masteryScore: masteryScore ?? 0,
        confidenceScore: confidenceScore ?? 0,
        evidenceCount: evidenceCount ?? 0
      },
      create: {
        profileId: profile.id,
        name,
        category,
        proficiencyLevel: proficiencyLevel || 'beginner',
        masteryScore: masteryScore ?? 0,
        confidenceScore: confidenceScore ?? 0,
        evidenceCount: evidenceCount ?? 0
      }
    });

    return res.json({ success: true, data: skill });
  } catch (error) {
    console.error('Error saving skill:', error);
    return res.status(500).json({ success: false, message: 'Failed to save skill' });
  }
});

router.post('/weaknesses', protect, async (req, res) => {
  try {
    const { topic, category, severity, impactScore, improvementPlan } = req.body;

    const profile = await prisma.learnerProfile.findUnique({ where: { userId: req.user.id } });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Learning profile not found' });
    }

    const weakness = await prisma.learnerWeakness.upsert({
      where: { profileId_topic: { profileId: profile.id, topic } },
      update: {
        category,
        severity: severity || 'medium',
        impactScore: impactScore || 0,
        improvementPlan,
        lastObservedAt: new Date()
      },
      create: {
        profileId: profile.id,
        topic,
        category,
        severity: severity || 'medium',
        impactScore: impactScore || 0,
        improvementPlan
      }
    });

    return res.json({ success: true, data: weakness });
  } catch (error) {
    console.error('Error saving weakness:', error);
    return res.status(500).json({ success: false, message: 'Failed to save weakness' });
  }
});

router.post('/snapshots', protect, async (req, res) => {
  try {
    const profile = await prisma.learnerProfile.findUnique({ where: { userId: req.user.id } });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Learning profile not found' });
    }

    const snapshot = await prisma.learningProgressSnapshot.create({
      data: {
        userId: req.user.id,
        profileId: profile.id,
        overallProgress: req.body.overallProgress || 0,
        weeklyProgress: req.body.weeklyProgress || 0,
        completedCourses: req.body.completedCourses || 0,
        completedLessons: req.body.completedLessons || 0,
        quizAverage: req.body.quizAverage || 0,
        studyStreak: req.body.studyStreak || 0,
        weeklyStudyHours: req.body.weeklyStudyHours || 0,
        focusScore: req.body.focusScore || 0,
        confidenceScore: req.body.confidenceScore || 0
      }
    });

    return res.json({ success: true, data: snapshot });
  } catch (error) {
    console.error('Error creating snapshot:', error);
    return res.status(500).json({ success: false, message: 'Failed to create progress snapshot' });
  }
});

export default router;
