import express from 'express';
import { protect, guardActiveEnrollment, checkNotBlocked } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { syncLearnerProfile } from '../services/profileSyncService.js';

const router = express.Router();

router.post('/ping', protect, checkNotBlocked, guardActiveEnrollment, async (req, res) => {
    try {
        const { courseId, lessonId, currentSecond } = req.body;
        const userId = req.user.id;

        if (!courseId || !lessonId || currentSecond === undefined) {
            return res.status(400).json({ success: false, message: 'Missing required progress data' });
        }

        const course = await prisma.course.findUnique({ 
            where: { id: courseId },
            include: { lessons: true }
        });
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }
        
        const lessons = course.lessons ? (Array.isArray(course.lessons) ? course.lessons : [course.lessons]) : [];
        const lesson = lessons.find(l => l.id === lessonId);
        
        if (!lesson) {
            return res.status(404).json({ success: false, message: 'Lesson not found in this course' });
        }

        const requiredDurationSeconds = (lesson.duration || 1) * 60;
        
        const segmentIndex = Math.floor(currentSecond / 30) * 30;

        let log = await prisma.progressLog.findFirst({ 
            where: { userId, lessonId }
        });
        
        let video_segments = [];
        let is_video_complete = false;

        if (!log) {
            video_segments = [segmentIndex];
        } else {
            video_segments = log.videoSegments ? (Array.isArray(log.videoSegments) ? log.videoSegments : [log.videoSegments]) : [];
            if (!video_segments.includes(segmentIndex)) {
                video_segments.push(segmentIndex);
            }
            is_video_complete = log.isVideoComplete;
        }

        const totalSecondsWatched = video_segments.length * 30;
        
        if (totalSecondsWatched >= (requiredDurationSeconds * 0.85)) {
            is_video_complete = true;
        }

        if (log) {
            log = await prisma.progressLog.update({
                where: { id: log.id },
                data: { videoSegments: video_segments, isVideoComplete: is_video_complete }
            });
        } else {
            log = await prisma.progressLog.create({
                data: {
                    userId,
                    courseId,
                    lessonId,
                    videoSegments: video_segments,
                    isVideoComplete: is_video_complete
                }
            });
        }

        res.status(200).json({
            success: true,
            message: 'Heartbeat logged',
            data: {
                isComplete: log.isVideoComplete,
                watchedSeconds: totalSecondsWatched,
                requiredSeconds: requiredDurationSeconds
            }
        });

        // Fire-and-forget: update LearnerProfile asynchronously — never blocks ping
        syncLearnerProfile(userId).catch(() => {});
    } catch (err) {
        console.error('Ping Error:', err);
        res.status(500).json({ success: false, message: 'Server error processing progress heartbeat' });
    }
});

router.post('/certificate', protect, checkNotBlocked, guardActiveEnrollment, async (req, res) => {
    try {
        const { courseId } = req.body;
        const userId = req.user.id;

        const course = await prisma.course.findUnique({ 
            where: { id: courseId },
            include: { lessons: true }
        });
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        // CHECK: Verify enrollment is approved by admin
        const enrollment = await prisma.enrollment.findFirst({
            where: { studentId: userId, courseId }
        });

        if (!enrollment || enrollment.status !== 'active') {
            return res.status(403).json({ 
                success: false, 
                message: 'Certificate Generation Denied: Your enrollment must be approved by an admin first.',
                approvalRequired: true
            });
        }
        
        const lessons = course.lessons ? (Array.isArray(course.lessons) ? course.lessons : [course.lessons]) : [];

        const userProgress = await prisma.userCourseProgress.findFirst({
            where: { userId, courseId }
        });

        let completedLessonIds = [];
        if (userProgress?.completedLessons) {
            if (Array.isArray(userProgress.completedLessons)) {
                completedLessonIds = userProgress.completedLessons;
            } else if (typeof userProgress.completedLessons === 'string') {
                try { completedLessonIds = JSON.parse(userProgress.completedLessons); } catch { /* ignore */ }
            }
        }

        const missingLessons = [];
        
        for (const lesson of lessons) {
            if (!completedLessonIds.includes(lesson.id)) {
                missingLessons.push({ lesson: lesson.title, reason: 'Lesson phase assessment not completed.' });
            }
        }

        if (course.isExamRequired) {
            const score = userProgress ? (userProgress.score || 0) : 0;
            const hasPassed = (userProgress && userProgress.passedFinalExam) || score >= 50;
            
            if (hasPassed) {
                // Passing the final exam overrides lesson completion requirements
                missingLessons.length = 0; 
                
                if (userProgress && !userProgress.completed) {
                    await prisma.userCourseProgress.update({
                        where: { id: userProgress.id },
                        data: { completed: true, passedFinalExam: true }
                    });
                }
            } else {
                missingLessons.push({ 
                    lesson: 'Final Challenge/Exam', 
                    reason: `Your score is ${score}%. You must pass the final challenge questions with 50% or higher to get your certificate.` 
                });
            }
        }

        if (missingLessons.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Certificate Generation Denied: Strict Learning Gates not met.',
                blocked_by: missingLessons
            });
        }

        let certificate = await prisma.certificate.findFirst({ 
            where: { userId, courseId } 
        });
        
        if (!certificate) {
            certificate = await prisma.certificate.create({
                data: {
                    userId,
                    courseId,
                    issueDate: new Date(),
                    issued: true,
                    verificationHash: `EDOT-${userId.toString().slice(-4)}-${courseId.toString().slice(-4)}-${Date.now().toString().slice(-4)}` // Unique tracking hash
                }
            });
            
            certificate = {
                ...certificate,
                certificate_id: certificate.id,
                user_id: certificate.userId,
                course_id: certificate.courseId,
                verified_hash: certificate.verificationHash,
                issue_date: certificate.issueDate
            };
        }

        res.status(200).json({
            success: true,
            message: 'Validation Successful. Certificate officially logged.',
            data: certificate
        });

    } catch (err) {
        console.error('Certificate Validation Error:', err);
        res.status(500).json({ success: false, message: 'Server error validating certificate rules' });
    }
});

export default router;
