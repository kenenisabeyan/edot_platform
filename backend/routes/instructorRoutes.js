import express from 'express';
import { prisma } from '../lib/prisma.js';
import { logActivity } from '../controllers/activityController.js';
import { protect, authorize } from '../middleware/auth.js';
import { onboardSingleCourse, onLessonModified } from '../src/intelligence/onboarding/courseOnboardingPipeline.js';

const router = express.Router();

router.use(protect);
router.use(authorize('instructor', 'admin'));

router.get('/courses', async (req, res) => {
    try {
        const userId = req.user.id;
        const courses = await prisma.course.findMany({
            where: { instructorId: userId },
            include: { 
                lessons: true,
                instructor: { select: { name: true, email: true, avatar: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json({ success: true, count: courses.length, data: courses });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

router.get('/students', async (req, res) => {
    try {
        const userId = req.user.id;
        const students = await prisma.user.findMany({
            where: {
                role: 'student',
                assignedInstructorId: userId
            },
            select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                status: true,
                createdAt: true,
                enrollments: {
                    select: {
                        course: { select: { title: true, status: true } }
                    }
                },
                certificates: true
            },
            orderBy: { createdAt: 'desc' }
        });

        const formattedStudents = students.map(student => {
            return {
                ...student,
                enrolledCourses: student.enrollments
            };
        });

        res.status(200).json({ success: true, count: formattedStudents.length, data: formattedStudents });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error retrieving assigned students', error: error.message });
    }
});

router.post('/courses', async (req, res) => {
    try {
        const userId = req.user.id;
        const validFields = {
            title: req.body.title,
            description: req.body.description,
            mainCategory: req.body.category || req.body.mainCategory || 'General',
            subCategory: req.body.subCategory || '',
            level: req.body.level || 'Beginner',
            duration: Number(req.body.duration) || 1,
            thumbnail: req.body.thumbnail || 'default-course.jpg',
            videoUrl: req.body.videoUrl || '',
            price: Number(req.body.price) || 0,
            requirements: req.body.requirements || [],
            whatYouWillLearn: req.body.whatYouWillLearn || [],
            tags: req.body.tags || [],
            isExamRequired: Boolean(req.body.isExamRequired),
            finalExam: req.body.finalExam || []
        };
        
        validFields.instructorId = userId;
        validFields.slug = (validFields.title || 'course').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
        
        if (req.user.role === 'admin') {
            validFields.status = 'approved';
            validFields.isPublished = true;
        } else {
            validFields.status = 'draft';
            validFields.isPublished = false;
        }

        const course = await prisma.course.create({ data: validFields });
        
        await logActivity(userId, `Created a new course: ${course.title}`, 'course', course.title, course.id);

        // Non-blocking Intelligence Onboarding
        onboardSingleCourse(course.id).catch(err => console.error('[Intelligence] Non-blocking onboard failed:', err.message));

        res.status(201).json({ success: true, data: course });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.put('/courses/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        let course = await prisma.course.findUnique({ where: { id: req.params.id } });

        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        if (course.instructorId !== userId && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: 'Not authorized to update this course' });
        }

        const validUpdateFields = {};
        if (req.body.title !== undefined) validUpdateFields.title = req.body.title;
        if (req.body.description !== undefined) validUpdateFields.description = req.body.description;
        if (req.body.category !== undefined) validUpdateFields.mainCategory = req.body.category;
        if (req.body.level !== undefined) validUpdateFields.level = req.body.level;
        if (req.body.duration !== undefined) validUpdateFields.duration = Number(req.body.duration);
        if (req.body.thumbnail !== undefined) validUpdateFields.thumbnail = req.body.thumbnail || 'default-course.jpg';
        if (req.body.videoUrl !== undefined) validUpdateFields.videoUrl = req.body.videoUrl;
        if (req.body.price !== undefined) validUpdateFields.price = Number(req.body.price);
        if (req.body.requirements !== undefined) validUpdateFields.requirements = req.body.requirements;
        if (req.body.whatYouWillLearn !== undefined) validUpdateFields.whatYouWillLearn = req.body.whatYouWillLearn;
        if (req.body.tags !== undefined) validUpdateFields.tags = req.body.tags;
        if (req.body.isExamRequired !== undefined) validUpdateFields.isExamRequired = Boolean(req.body.isExamRequired);
        if (req.body.finalExam !== undefined) validUpdateFields.finalExam = req.body.finalExam;

        if (course.status === 'approved' && req.user.role !== 'admin') {
            validUpdateFields.status = 'draft';
            validUpdateFields.isPublished = false;
        }

        course = await prisma.course.update({
            where: { id: req.params.id },
            data: validUpdateFields
        });
        
        await logActivity(userId, `Updated course: ${course.title}`, 'course', course.title, course.id);

        // Non-blocking Intelligence Refresh
        onboardSingleCourse(course.id, { forceRefresh: true }).catch(err => console.error('[Intelligence] Non-blocking refresh failed:', err.message));

        res.status(200).json({ success: true, data: course });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

router.post('/courses/:courseId/lessons', async (req, res) => {
    try {
        const userId = req.user.id;
        const course = await prisma.course.findUnique({ 
            where: { id: req.params.courseId },
            include: { lessons: true }
        });

        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        if (course.instructorId !== userId && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: 'Not authorized to add a lesson to this course' });
        }

        const lessonData = {
            title: req.body.title,
            description: req.body.description,
            videoUrl: req.body.videoUrl,
            duration: Number(req.body.duration),
            courseId: req.params.courseId,
            order: req.body.order || (course.lessons.length + 1),
            readingMaterials: req.body.readingMaterials || '',
            quiz: req.body.quiz || [],
            phase: req.body.phase || ''
        };

        const lesson = await prisma.lesson.create({ data: lessonData });

        // Non-blocking Intelligence Lesson Indexing
        onLessonModified(lesson.id, req.params.courseId, lessonData).catch(err => console.error('[Intelligence] Non-blocking lesson index failed:', err.message));

        res.status(201).json({ success: true, data: lesson });
    } catch (error) {
        let errMsg = error.message;
        if (errMsg.includes('invocation:')) {
            errMsg = errMsg.split('}').pop().trim() || errMsg;
        }
        res.status(400).json({ success: false, message: errMsg });
    }
});

router.put('/courses/:id/submit', async (req, res) => {
    try {
        const userId = req.user.id;
        let course = await prisma.course.findUnique({ where: { id: req.params.id } });

        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        if (course.instructorId !== userId && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: 'Not authorized to publish this course' });
        }

        let updateData = { status: 'pending' };
        if (req.user.role === 'admin') {
            updateData.status = 'approved';
            updateData.isPublished = true;
        }

        course = await prisma.course.update({
            where: { id: req.params.id },
            data: updateData
        });

        res.status(200).json({ success: true, data: course });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

router.get('/analytics/detailed', async (req, res) => {
    try {
        const userId = req.user.id;
        const courses = await prisma.course.findMany({ where: { instructorId: userId } });
        const courseIds = courses.map(c => c.id);
        
        const enrollments = await prisma.enrollment.findMany({
            where: { courseId: { in: courseIds } },
            include: { student: { select: { createdAt: true } } }
        });
        const users = enrollments.map(e => e.student).filter(Boolean);

        const revenueData = [];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const d = new Date();
        for (let i = 5; i >= 0; i--) {
            let m = new Date(d.getFullYear(), d.getMonth() - i, 1);
            let monthRev = 0;
            courses.forEach(c => {
                const actualStudents = enrollments.filter(e => e.courseId === c.id).length;
                if (c.isPublished && c.price && (actualStudents > 0 || c.totalStudents)) {
                    const numStudents = actualStudents > 0 ? actualStudents : (c.totalStudents || 0);
                    if (new Date(c.createdAt) <= new Date(m.getFullYear(), m.getMonth() + 1, 0)) {
                         monthRev += (c.price * numStudents); 
                    }
                }
            });
            revenueData.push({ name: monthNames[m.getMonth()], revenue: monthRev });
        }

        const engagementData = [];
        for (let i = 3; i >= 0; i--) {
            let start = new Date();
            start.setDate(start.getDate() - (i*7));
            let sCount = users.filter(u => new Date(u.createdAt) <= start).length;
            engagementData.push({ name: `Week ${4-i}`, students: sCount, teachers: 1 });
        }

        let total = courses.length;
        let published = courses.filter(c => c.isPublished).length;
        const courseCompletionData = [
            { name: 'Active Classes', value: published, color: '#10b981' },
            { name: 'Drafts', value: (total - published), color: '#f59e0b' }
        ];

        const completionsCount = await prisma.userCourseProgress.count({
            where: {
                courseId: { in: courseIds },
                OR: [{ completed: true }, { progress: { gte: 100 } }, { status: 'completed' }]
            }
        });

        res.status(200).json({
            success: true,
            data: {
                revenueData,
                engagementData,
                courseCompletionData,
                totalRevenue: revenueData.reduce((acc, curr) => acc + curr.revenue, 0),
                totalActiveLearners: users.length,
                totalCourseCompletions: completionsCount 
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

router.get('/dashboard', async (req, res) => {
    try {
        const userId = req.user.id;
        const courses = await prisma.course.findMany({
            where: { instructorId: userId },
            select: {
                id: true,
                title: true,
                totalStudents: true,
                isPublished: true,
                createdAt: true,
                _count: { select: { lessons: true } }
            }
        });
        
        const totalCourses = courses.length;
        const activeCourses = courses.filter(c => c.isPublished).length;
        
        let totalStudents = 0;
        courses.forEach(course => {
            totalStudents += (course.totalStudents || 0); 
        });

        let totalLessons = 0;
        courses.forEach(course => {
            totalLessons += course._count?.lessons || 0;
        });

        const courseIds = courses.map(c => c.id);
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        
        const rawLogs = await prisma.progressLog.findMany({
            where: {
                courseId: { in: courseIds },
                updatedAt: { gte: fiveDaysAgo }
            },
            include: { course: { select: { title: true } } }
        });

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const topCourses = courses.slice(0, 3).map(c => ({ id: c.id, title: c.title }));
        
        const studentPerformanceData = [4, 3, 2, 1, 0].map(diff => {
            const d = new Date();
            d.setDate(d.getDate() - diff);
            return {
                name: days[d.getDay()],
                dateStr: d.toISOString().split('T')[0],
                value1: 0,
                value2: 0,
                value3: 0
            };
        });

        rawLogs.forEach(log => {
             const logDate = new Date(log.updatedAt).toISOString().split('T')[0];
             const targetDay = studentPerformanceData.find(d => d.dateStr === logDate);
             if (targetDay) {
                  const cid = log.courseId;
                  if (topCourses[0] && cid === topCourses[0].id) targetDay.value1 += 1;
                  else if (topCourses[1] && cid === topCourses[1].id) targetDay.value2 += 1;
                  else if (topCourses[2] && cid === topCourses[2].id) targetDay.value3 += 1;
             }
        });

        const cleanStudentPerformance = studentPerformanceData.map(({name, value1, value2, value3}) => ({name, value1, value2, value3}));

        res.status(200).json({
            success: true,
            data: {
                totalCourses,
                activeCourses,
                totalStudents,
                totalLessons,
                studentPerformanceData: cleanStudentPerformance,
                courseNames: topCourses.map(c => c.title)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

export default router;
