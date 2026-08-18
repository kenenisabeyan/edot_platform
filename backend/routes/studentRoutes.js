import express from 'express';
import { protect, authorize, checkNotBlocked } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { logActivity } from '../controllers/activityController.js';
import { publishLearningEvent } from '../src/intelligence/events/learningEventService.js';

const router = express.Router();

router.use(protect);
router.use(checkNotBlocked);
router.use(authorize('student', 'instructor', 'admin')); // Anyone who can enroll

router.get('/enrollments', async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                userCourseProgress: {
                    include: {
                        course: {
                            include: { instructor: { select: { name: true, avatar: true } } }
                        }
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const enrolledCourses = (user.userCourseProgress || []).filter(e => e.status === 'active' || e.status === 'completed' || e.completed === true);

        res.status(200).json({
            success: true,
            count: enrolledCourses.length,
            data: enrolledCourses
        });
    } catch (error) {
        console.error('Fetch enrollments error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

router.get('/courses/:courseId/status', async (req, res) => {
    try {
        const { courseId } = req.params;
        const studentId = req.user.id;
        
        const enrollment = await prisma.enrollment.findUnique({
            where: { studentId_courseId: { studentId, courseId } }
        });

        const progress = await prisma.userCourseProgress.findFirst({
            where: { userId: studentId, courseId }
        });

        if (!enrollment && !progress) {
            return res.status(200).json({ success: true, status: 'none', progress: null });
        }

        const currentStatus = enrollment ? enrollment.status : (progress?.status || 'active');

        res.status(200).json({ 
            success: true, 
            status: currentStatus,
            progress: progress || null,
            rejectionReason: enrollment ? (enrollment.rejectionReason || enrollment.reason) : ''
        });
    } catch (error) {
        console.error('Fetch enrollment status error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

router.post('/courses/:courseId/enroll', async (req, res) => {
    try {
        const { courseId } = req.params;
        const studentId = req.user.id;

        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        const existingProgress = await prisma.userCourseProgress.findFirst({
            where: { userId: studentId, courseId }
        });

        if (existingProgress) {
            return res.status(400).json({ success: false, message: 'You are already enrolled in this course.' });
        }

        const existingEnrollment = await prisma.enrollment.findUnique({
            where: {
                studentId_courseId: { studentId, courseId }
            }
        });

        if (existingEnrollment) {
             return res.status(400).json({ success: false, message: 'You already have a pending enrollment request for this course.' });
        }

        const enrollment = await prisma.enrollment.create({
            data: {
                studentId,
                courseId,
                status: 'pending'
            }
        });

        // Auto-assign to category group
        if (course.mainCategory) {
            let group = await prisma.learnerGroup.findUnique({ where: { name: course.mainCategory } });
            if (!group) {
                group = await prisma.learnerGroup.create({
                    data: { name: course.mainCategory, description: `${course.mainCategory} Category Group` }
                });
            }
            await prisma.user.update({
                where: { id: studentId },
                data: { learnerGroups: { connect: { id: group.id } } }
            });
        }

        await prisma.userCourseProgress.create({
            data: {
                userId: studentId,
                courseId,
                status: 'pending',
                progress: 0,
                completedLessons: []
            }
        });

        await logActivity(studentId, `Enrolled in ${course.title}`, 'learning', course.title, courseId);

        // Fire-and-forget: publish COURSE_ENROLLED event
        publishLearningEvent({
            userId: studentId,
            eventType: 'COURSE_ENROLLED',
            courseId,
            metadata: { courseTitle: course.title, category: course.mainCategory }
        }).catch(() => {});

        res.status(201).json({
            success: true,
            message: 'Enrollment requested successfully. Awaiting administrator approval.',
            enrollment
        });
    } catch (error) {
        console.error('Enrollment error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

router.post('/courses/:courseId/lessons/:lessonId/complete', async (req, res) => {
    try {
        const { courseId, lessonId } = req.params;
        const userId = req.user.id;
        
        const course = await prisma.course.findUnique({ where: { id: courseId } });

        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        const enrollment = await prisma.userCourseProgress.findFirst({
            where: { userId, courseId }
        });

        if (!enrollment) {
            return res.status(400).json({ success: false, message: 'Not enrolled in this course' });
        }

        let completedLessons = enrollment.completedLessons ? 
            (Array.isArray(enrollment.completedLessons) ? enrollment.completedLessons : [enrollment.completedLessons]) : [];

        if (!completedLessons.includes(lessonId)) {
            completedLessons.push(lessonId);
            
            const lessons = course.lessons ? 
                (Array.isArray(course.lessons) ? course.lessons : [course.lessons]) : [];
            const totalLessons = lessons.length;
            
            let progress = enrollment.progress || 0;
            if (totalLessons > 0) {
                progress = Math.round((completedLessons.length / totalLessons) * 100);
            } else {
                progress = 100;
            }

            await prisma.userCourseProgress.update({
                where: { id: enrollment.id },
                data: { completedLessons, progress }
            });

            await logActivity(userId, `Completed a lesson in ${course.title}`, 'learning', course.title, course.id);

            // Fire-and-forget: publish LESSON_COMPLETED event
            publishLearningEvent({
                userId,
                eventType: 'LESSON_COMPLETED',
                courseId,
                lessonId,
                progress,
                metadata: { courseTitle: course.title, totalCompleted: completedLessons.length }
            }).catch(() => {});
        }

        res.status(200).json({
            success: true,
            progress: enrollment.progress,
            completedLessons
        });
    } catch (error) {
        console.error('Mark lesson complete error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

router.post('/courses/:courseId/exam/complete', async (req, res) => {
    try {
        const { courseId } = req.params;
        const { score } = req.body;
        const userId = req.user.id;
        
        const enrollment = await prisma.userCourseProgress.findFirst({
            where: { userId, courseId }
        });

        if (!enrollment) {
            return res.status(400).json({ success: false, message: 'Not enrolled in this course' });
        }

        if (score !== undefined && Number(score) < 75) {
            return res.status(400).json({ 
                success: false, 
                message: `You scored ${score}%. A mark of 75% or higher is required. Please try again to upgrade your mark and earn your certificate.`
            });
        }

        await prisma.userCourseProgress.update({
            where: { id: enrollment.id },
            data: { passedFinalExam: true, score: Number(score) || 0, completed: true, progress: 100, status: 'completed' }
        });
        
        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (course) {
           await logActivity(userId, `Passed final exam for ${course.title}`, 'learning', course.title, course.id);
        }

        res.status(200).json({ success: true, passedFinalExam: true, message: 'Congratulations! You passed the final exam.' });
    } catch (error) {
        console.error('Submit exam error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

router.get('/analytics/detailed', async (req, res) => {
    try {
        const userId = req.user.id;
        const student = await prisma.user.findUnique({ 
            where: { id: userId },
            include: { userCourseProgress: true }
        });

        res.status(200).json({
            success: true,
            data: {
                revenueData: [],
                engagementData: [],
                courseCompletionData: [
                   { name: 'Enrolled', value: student?.userCourseProgress?.length || 1, color: '#10b981' }
                ],
                totalRevenue: 0,
                totalActiveLearners: 1,
                totalCourseCompletions: 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});



export default router;
